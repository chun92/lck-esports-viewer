const express = require('express')
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const router = express.Router()

const dataPath = path.resolve(__dirname, '..', '..', process.env.DATA_PATH)
const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

const listPath = path.resolve(__dirname, '..', '..', process.env.PLAYER_LIST_PATH)
const listRows = parse(fs.readFileSync(listPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    cast: (value, ctx) => {
        if (ctx.column === 'DebutYear') return value ? Number(value) : null
        if (ctx.column === 'IsActive') return value === '1'
        return value
    },
})

router.get('/', (req, res) => {
    res.json(listRows)
})

router.get('/:id', (req, res) => {
    const key = req.params.id
    const player =
        players.find(p => p.Player.Player === key) ||
        players.find(p => p.Player.ID === key)
    if (!player) {
        return res.status(404).json({ error: 'Player not found', id: key })
    }
    res.json(player)
})

module.exports = router