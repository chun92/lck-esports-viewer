const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const dataPath = path.resolve(__dirname, '..', '..', process.env.DATA_PATH)
const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

router.get('/', (req, res) => {
    res.json(players.map(p => p.Player))
})

router.get('/:id', (req, res) => {
    const player = players.find(p => p.Player.ID === req.params.id)
    if (!player) {
        return res.status(404).json({ error: 'Player not found', id: req.params.id })
    }
    res.json(player)
})

module.exports = router