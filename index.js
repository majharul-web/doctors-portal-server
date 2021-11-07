const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6soco.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function run() {
    try {
        await client.connect()
        console.log('database connect success');

        const database = client.db("doctorsDB");
        const appointmentsCollections = database.collection("appointments");
        const usersCollections = database.collection("users");

        // insert appointments
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollections.insertOne(appointment)
            console.log(result);
            res.json(result)
        })

        // get appointments
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, date: date };
            const result = await appointmentsCollections.find(query).toArray();
            res.send(result)
        })

        // save user info manual login
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result);
        })

        // save user info google login
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const doc = { $set: user }
            const result = await usersCollections.updateOne(filter, doc, options);
            res.send(result)
        })


    }
    finally {
        //   await client.close();
    }

}
run().catch(console.dir);

// -------------home-----------------
app.get('/', (req, res) => {
    res.send('doctors portal running');
})

app.listen(port, () => {
    console.log(`Doctors Portal listening at http://localhost:${port}`);
})
// -------------home-----------------