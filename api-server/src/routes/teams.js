const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const teamsPath = path.resolve(__dirname, '..', '..', process.env.TEAMS_PATH)
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'))

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

router.get('/:id', (req, res) => {
    const team = teams.find(t => t.OverviewPage === req.params.id)
    if (!team) {
        return res.status(404).json({ error: 'Team not found', id: req.params.id })
    }
    res.json(team)
})

module.exports = router
