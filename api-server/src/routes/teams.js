const express = require('express')
const fs = require('fs')
const path = require('path')
const { parse: parseCsv } = require('csv-parse/sync')

const router = express.Router()

const teamsPath = path.resolve(__dirname, '..', '..', process.env.TEAMS_PATH)
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'))

const historicalLogosPath = path.resolve(__dirname, '..', '..', process.env.HISTORICAL_LOGOS_PATH)
const historicalLogosRaw = JSON.parse(fs.readFileSync(historicalLogosPath, 'utf-8'))
const historicalLogos = Object.fromEntries(
    Object.entries(historicalLogosRaw).map(([name, info]) => [name, { LogoUrl: info.url }])
)

const teamRedirectsPath = path.resolve(__dirname, '..', '..', process.env.TEAM_REDIRECTS_PATH)
const redirectRows = parseCsv(fs.readFileSync(teamRedirectsPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
})
const aliasesByPage = new Map()
for (const r of redirectRows) {
    if (!r.PageName || !r.AllName) continue
    const list = aliasesByPage.get(r.PageName) ?? []
    if (!list.includes(r.AllName)) list.push(r.AllName)
    aliasesByPage.set(r.PageName, list)
}

const derivePeriod = (history, isDisbanded) => {
    let since = null
    let until = null
    for (const p of history) {
        if (p.StartDate && (since === null || p.StartDate < since)) since = p.StartDate
        if (p.EndDate && (until === null || p.EndDate > until)) until = p.EndDate
    }
    return { ActiveSince: since, ActiveUntil: isDisbanded ? until : null }
}

const summary = (t) => {
    const { ActiveSince, ActiveUntil } = derivePeriod(t.PlayerHistory || [], t.IsDisbanded)
    const aliases = (aliasesByPage.get(t.OverviewPage) || []).filter(
        (a) => a !== t.Name && !(t.FormerNames || []).includes(a)
    )
    return {
        OverviewPage: t.OverviewPage,
        Name: t.Name,
        Short: t.Short,
        Region: t.Region,
        LogoUrl: t.LogoUrl,
        IsDisbanded: t.IsDisbanded,
        RenamedTo: t.RenamedTo,
        FormerNames: t.FormerNames || [],
        Aliases: aliases,
        ActiveSince,
        ActiveUntil,
        HistoryCount: (t.PlayerHistory || []).length,
    }
}

router.get('/', (req, res) => {
    res.json(teams.map(summary))
})

router.get('/historical-logos', (req, res) => {
    res.json(historicalLogos)
})

router.get('/:id', (req, res) => {
    const team = teams.find(t => t.OverviewPage === req.params.id)
    if (!team) {
        return res.status(404).json({ error: 'Team not found', id: req.params.id })
    }
    res.json(team)
})

module.exports = router
