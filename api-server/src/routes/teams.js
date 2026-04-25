const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const teamsPath = path.resolve(__dirname, '..', '..', process.env.TEAMS_PATH)
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'))

const historicalLogosPath = path.resolve(__dirname, '..', '..', process.env.HISTORICAL_LOGOS_PATH)
const historicalLogosRaw = JSON.parse(fs.readFileSync(historicalLogosPath, 'utf-8'))
const historicalLogos = Object.fromEntries(
    Object.entries(historicalLogosRaw).map(([name, info]) => [name, { LogoUrl: info.url }])
)

const summary = (t) => ({
    OverviewPage: t.OverviewPage,
    Name: t.Name,
    Short: t.Short,
    Region: t.Region,
    LogoUrl: t.LogoUrl,
    IsDisbanded: t.IsDisbanded,
    RenamedTo: t.RenamedTo,
    FormerNames: t.FormerNames || [],
})

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
