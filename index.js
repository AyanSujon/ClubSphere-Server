




const express = require('express')
const cors = require('cors');

const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000


// Middleware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tachgq7.mongodb.net/assignment-B12A11?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db('assignment-B12A11');
    const usersCollection = db.collection('users');
    const clubsCollection = db.collection('clubs');
    const eventsCollection = db.collection('events');
    const eventRegistrationsCollection = db.collection('eventRegistrations');






    // app.post('/register', async(req, res)=>{
    //   console.log(req.dody , "request");
    // })



    app.post('/users', async (req, res) => {
      const user = req.body;
      // user.role = 'user';
      // user.createdAt = new Date();
      user.role = 'member',
      user.createdAt = new Date().toISOString() // <-- dynamic timestamp
      const email = user.email;
      const userExists = await usersCollection.findOne({ email })
      console.log("user data: ", user)
      console.log("existing user", userExists)
      if (userExists) {
        return res.send({ message: 'user exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })





// Recently Added Clubs API
app.get('/clubs', async (req, res) => {
    try {
        const query = {};
        const { category, location, managerEmail } = req.query;

        // Optional filters
        if (category) {
            query.category = category;
        }

        if (location) {
            query.location = location;
        }

        if (managerEmail) {
            query.managerEmail = managerEmail;
        }

        // Sort by newest first
        const options = { sort: { createdAt: -1 } };

        const cursor = clubsCollection.find(query, options);
        const result = await cursor.toArray();

        res.status(200).send(result);
    } catch (error) {
        console.error("Failed to fetch clubs:", error);
        res.status(500).send({ message: "Failed to fetch clubs" });
    }
});




// // Upcoming Events API
// app.get('/events/upcoming', async (req, res) => {
//     try {
//         const query = {};
//         const { clubId, isPaid, location } = req.query;

//         // Filter by clubId
//         if (clubId) {
//             query.clubId = clubId;
//         }

//         // Filter by paid/free events
//         if (isPaid) {
//             query.isPaid = isPaid === "true"; // convert string → boolean
//         }

//         // Filter by location
//         if (location) {
//             query.location = location;
//         }

//         // Only future events
//         query.eventDate = { $gte: new Date() };

//         // Sort by nearest upcoming
//         const options = { sort: { eventDate: 1 } };

//         const cursor = eventsCollection.find(query, options);
//         const result = await cursor.toArray();

//         res.status(200).send(result);
//     } catch (error) {
//         console.error("Failed to fetch upcoming events:", error);
//         res.status(500).send({ message: "Failed to fetch upcoming events" });
//     }
// });




// Upcoming Events API
app.get('/events/upcoming', async (req, res) => {
    try {
        const query = {};
        const { clubId, isPaid, location } = req.query;

        if (clubId) query.clubId = clubId;
        if (isPaid) query.isPaid = isPaid === "true";
        if (location) query.location = location;

        // Handle both string and Date types
        const nowISO = new Date().toISOString();

        query.eventDate = { $gte: nowISO };

        const options = { sort: { eventDate: 1 } };

        const events = await eventsCollection.find(query, options).toArray();
        res.send(events);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch upcoming events" });
    }
});


















    // Payment Related Apis 
    app.post('/register-event-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
          
            price_data: {
              currency: 'USD',
              unit_amount: amount,
              product_data: {
                name: paymentInfo.eventName
              }
            },
           
            quantity: 1,
          },
        ],
         customer_email: paymentInfo.userEmail, 
        mode: 'payment',
        metadata: {
          parcelId: paymentInfo.eventId 
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      })

      console.log(session);
      res.send({url: session.url});
    })























    // POST: Register for an event
app.post("/event-registrations", async (req, res) => {
  try {
    const registration = req.body;
    const { eventId, userEmail } = registration;

    // Validate required fields
    if (!eventId || !userEmail) {
      return res.status(400).send({ message: "Missing required fields." });
    }

    // Prevent duplicate registration
    const existing = await eventRegistrationsCollection.findOne({
      eventId,
      userEmail,
    });

    if (existing) {
      return res.status(409).send({ message: "Already registered." });
    }

    // Add server timestamp if not provided
    registration.registeredAt = registration.registeredAt || new Date();

    // Insert into DB
    const result = await eventRegistrationsCollection.insertOne(registration);

    res.send({
      success: true,
      message: "Event registered successfully!",
      data: result,
    });

  } catch (error) {
    console.error("Event Registration Error →", error);
    res.status(500).send({ message: "Internal server error", error });
  }
});




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



























app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

