require('dotenv').config()

const express = require('express')
const app = express()
const port = process.env.PORT || 4444
const cors = require('cors')

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

const playersRouter = require('./routes/players')
app.use('/players', playersRouter)

const teamsRouter = require('./routes/teams')
app.use('/teams', teamsRouter)

app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path })
})

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})