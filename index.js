const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const fileUpload = require('express-fileupload');

// token part
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6soco.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {

    if (req.headers.authorization.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect()
        console.log('database connect success');

        const database = client.db("doctorsDB");
        const appointmentsCollections = database.collection("appointments");
        const usersCollections = database.collection("users");
        const doctorsCollections = database.collection("doctors");

        // insert appointments
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollections.insertOne(appointment)
            console.log(result);
            res.json(result)
        })

        // get appointments
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date };
            const result = await appointmentsCollections.find(query).toArray();
            res.send(result)
        })

        // get admin
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollections.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }

            res.json({ admin: isAdmin });
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

        // add admin
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollections.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } }
                    const result = await usersCollections.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.statusCode(403).json({ message: 'you dont allowed' })
            }
        })

        // get specific appointment
        app.get('/appointment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await appointmentsCollections.findOne(query);
            res.json(result);
        })

        // payment method
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret });

        })

        // update payment status
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            }
            const result = await appointmentsCollections.updateOne(filter, updateDoc);
            res.send(result);
        })

        // add doctor
        app.post('/doctors', async (req, res) => {
            const name = req.body.name;
            const email = req.body.email
            const image = req.files.image;
            const imageData = image.data;
            const encodedImage = imageData.toString('base64');
            const imageBuffer = Buffer.from(encodedImage, 'base64');
            const doctor = {
                name: name,
                email: email,
                image: imageBuffer
            }
            const result = await doctorsCollections.insertOne(doctor);
            res.json(result);
        })

        // show doctors
        app.get('/doctors', async (req, res) => {
            const doctors = await doctorsCollections.find({}).toArray();
            res.json(doctors)
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