




const express = require('express')
const cors = require('cors');

const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000


// Middleware
app.use(cors());
app.use(express.json())







const verifYFBToken = (req, res, next)=>{
  console.log("headers in the middleware", req.headers.authorization)
  const token = req.headers.authorization;
  if(!token){
    return res.status(401).send({message: `unauthorized access`})

  }
  
  next();


}

















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
    const clubMembershipCollection = db.collection('clubMembership');
    const paymentCollection = db.collection('payments');






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



// get User Role verification for Route 
app.get('/users/:email/role', async (req, res) => {
  try {
    const email = req.params.email;
    const query = { email };
    const user = await usersCollection.findOne(query);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.send({ role: user.role || 'member' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


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
















    // Payment Related Apis 
    app.post('/payment-checkout-session', async (req, res) => {
      const paymentInfo = req.body;

      console.log(paymentInfo);
      const amount = parseInt(paymentInfo.amount) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {

            price_data: {
              currency: 'USD',
              unit_amount: amount,
              product_data: {
                name: paymentInfo.eventTitle
              }
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo.userEmail,
        mode: 'payment',
        metadata: {
          userEmail: paymentInfo.userEmail,
          amount: paymentInfo.amount,
          paymentType: paymentInfo.paymentType,
          clubId: paymentInfo.clubId,
          eventId: paymentInfo.eventId,
          transactionId: null,
          status: "pending",
          createdAt: new Date().toISOString(),
          eventTitle: paymentInfo.eventTitle,

        },
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      })

      console.log(session);
      res.send({ url: session.url });
    })






    // // Payment success api from jhonkar vaiya
    // app.patch('/payment-success', async (req, res) => {
    //   const sessionId = req.query.session_id;
    //   // console.log(`session Id: `, sessionId);

    //   const session = await stripe.checkout.sessions.retrieve(sessionId);
    //   console.log(`session retrives: `, session)
    //   if (session.payment_status === 'paid') {
    //     const id = session.metadata.eventId;
    //     const query = { _id: new Object(id) };
    //     const update = {
    //       $set: {
    //         paymentStatus: 'paid',

    //       }
    //     }
    //     const result = await paymentCollection.insertOne()
    //   }
    //   res.send({ success: true })
    //   res.send({ success: true });
    // })








// app.patch('/payment-success', async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     const session = await stripe.checkout.sessions.retrieve(sessionId);
//     console.log("Stripe Session:", session);

//     if (session.payment_status === 'paid') {

//       // Prepare Payment Info
//       const paymentInfo = {
//         userEmail: session.metadata.userEmail,
//         amount: session.metadata.amount,
//         eventId: session.metadata.eventId,
//         eventTitle: session.metadata.eventTitle,
//         clubId: session.metadata.clubId,
//         transactionId: sessionId,
//         status: "paid",
//         paidAt: new Date(),
//       };

//       // Check if payment already exists
//       let saveResult = await paymentCollection.findOne({ transactionId: sessionId });
//       if (!saveResult) {
//         saveResult = await paymentCollection.insertOne(paymentInfo);
//         console.log("Payment Saved:", saveResult);
//       } else {
//         console.log("Payment already exists:", saveResult);
//       }

//       // Prepare Event Registration
//       const registration = {
//         eventId: session.metadata.eventId,
//         userEmail: session.metadata.userEmail,
//         clubId: session.metadata.clubId,
//         status: "registered",
//         paymentId: session.payment_intent,
//         registeredAt: new Date().toISOString(),
//       };

//       // Check if registration already exists
//       let registrationResult = await eventRegistrationsCollection.findOne({
//         eventId: session.metadata.eventId,
//         userEmail: session.metadata.userEmail,
//       });

//       if (!registrationResult) {
//         registrationResult = await eventRegistrationsCollection.insertOne(registration);
//         console.log("Registration Saved:", registrationResult);
//       } else {
//         console.log("Registration already exists:", registrationResult);
//       }

//       return res.send({
//         success: true,
//         message: "Payment saved successfully",
//         paymentInfo,
//         registrationInfo: registrationResult,
//       });
//     }

//     res.status(400).send({ success: false, message: "Payment not completed" });

//   } catch (error) {
//     res.status(500).send({
//       success: false,
//       message: "Payment success API error",
//       error: error.message,
//     });
//   }
// });





app.patch('/payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Stripe Session:", session);

    if (session.payment_status === 'paid') {

      // Prepare Payment Info
      const paymentInfo = {
        userEmail: session.metadata.userEmail,
        amount: session.metadata.amount,
        paymentType: "event",
        clubId: session.metadata.clubId,
        eventId: session.metadata.eventId,
        transactionId: sessionId,
        status: "paid",
        createdAt: new Date(),
        eventTitle: session.metadata.eventTitle,
      };

      // Upsert Payment (insert if not exists)
      const paymentResult = await paymentCollection.updateOne(
        { transactionId: sessionId },   // filter
        { $setOnInsert: paymentInfo },   // insert only if doesn't exist
        { upsert: true }
      );
      console.log("Payment Result:", paymentResult);

      // Prepare Event Registration
      const registration = {
        eventId: session.metadata.eventId,
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
        status: "registered",
        paymentId: sessionId, // Use transactionId to uniquely link
        registeredAt: new Date().toISOString(),
      };

      // Upsert Registration to avoid duplicates
      const registrationResult = await eventRegistrationsCollection.updateOne(
        { eventId: session.metadata.eventId, userEmail: session.metadata.userEmail },
        { $setOnInsert: registration },
        { upsert: true }
      );
      console.log("Registration Result:", registrationResult);

      return res.send({
        success: true,
        message: "Payment and registration processed successfully",
        paymentInfo,
        registrationInfo: registration,
      });
    }

    res.status(400).send({ success: false, message: "Payment not completed" });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Payment success API error",
      error: error.message,
    });
  }
});




















// Club Membership api
// Payment: Club Membership Checkout Session
app.post('/payment-club-membership', async (req, res) => {
  try {
    const paymentInfo = req.body;
    console.log("Club Payment Info:", paymentInfo);

    // Convert membership fee
    const amount = parseInt(paymentInfo.cost) * 100;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'USD',
            unit_amount: amount,
            product_data: {
              name: `${paymentInfo.clubName} - Club Membership`,
            }
          },
          quantity: 1,
        },
      ],

      customer_email: paymentInfo.userEmail,
      mode: 'payment',

      metadata: {
        userEmail: paymentInfo.userEmail,
        clubId: paymentInfo.clubId,
        category: paymentInfo.category,
        managerEmail: paymentInfo.managerEmail,
        cost: paymentInfo.cost,
        paymentType: paymentInfo.paymentType, // "club-membership"
        bannerImage: paymentInfo.bannerImage,
        location: paymentInfo.location,
        description: paymentInfo.description,
        createdAt: paymentInfo.createdAt,
        status: "pending"
      },

      success_url: `${process.env.SITE_DOMAIN}/club-membership-payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_DOMAIN}/club-membership-payment-cancelled`,
    });

    console.log("Stripe Session:", session);

    // Send Checkout URL to frontend
    res.send({ url: session.url });

  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).send({ error: error.message });
  }
});







// app.patch('/payment-success', async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     if (!sessionId) {
//       return res.status(400).send({ success: false, message: "Session ID missing" });
//     }

//     const session = await stripe.checkout.sessions.retrieve(sessionId);
//     console.log("Stripe Session:", session);

//     if (session.payment_status !== 'paid') {
//       return res.status(400).send({
//         success: false,
//         message: "Payment not completed",
//       });
//     }

//     // -------------------------------
//     // 1️⃣ Save Payment Info
//     // -------------------------------
//     const paymentInfo = {
//       userEmail: session.metadata.userEmail,
//       amount: session.metadata.amount,
//       eventId: session.metadata.eventId,
//       eventTitle: session.metadata.eventTitle,
//       clubId: session.metadata.clubId,
//       transactionId: sessionId,
//       paymentIntent: session.payment_intent,
//       status: "paid",
//       paidAt: new Date(),
//     };

//     const paymentResult = await paymentCollection.insertOne(paymentInfo);
//     console.log("Payment Saved:", paymentResult.insertedId);

//     // -------------------------------
//     // 2️⃣ Save Event Registration
//     // -------------------------------
//     const registration = {
//       eventId: session.metadata.eventId,
//       userEmail: session.metadata.userEmail,
//       clubId: session.metadata.clubId,
//       status: "registered",
//       paymentId: session.payment_intent,
//       registeredAt: new Date(),
//     };

//     const registrationResult = await eventRegistrationsCollection.insertOne(registration);
//     console.log("Registration Saved:", registrationResult.insertedId);

//     // -------------------------------
//     // 3️⃣ Save Club Membership (NEW)
//     // -------------------------------

//     // avoid duplicate membership
//     const existingMembership = await clubMembershipCollection.findOne({
//       clubId: session.metadata.clubId,
//       userEmail: session.metadata.userEmail,
//     });

//     if (!existingMembership) {
//       const membership = {
//         userEmail: session.metadata.userEmail,
//         clubId: session.metadata.clubId,
//         joinedAt: new Date(),
//         transactionId: sessionId,
//         paymentId: session.payment_intent,
//         status: "active",
//       };

//       const membershipResult = await clubMembershipCollection.insertOne(membership);
//       console.log("Membership Saved:", membershipResult.insertedId);
//     } else {
//       console.log("User already has membership. Skipped inserting new membership.");
//     }

//     // -------------------------------
//     // Final Response
//     // -------------------------------
//     return res.send({
//       success: true,
//       message: "Payment & related data saved successfully",
//       paymentInfo,
//       registrationInfo: registrationResult,
//     });

//   } catch (error) {
//     console.error("Payment Success Error:", error);
//     res.status(500).send({
//       success: false,
//       message: "Payment success API error",
//       error: error.message,
//     });
//   }
// });











// Club Membership Payment Success API
app.patch('/club-membership-payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).send({ success: false, message: "Session ID is required" });
    }

    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Stripe Session:", session);

    if (session.payment_status === 'paid') {
      // Prepare payment info for payments collection
      const paymentInfo = {
        userEmail: session.metadata.userEmail,
        amount: session.metadata.cost,
        clubId: session.metadata.clubId,
        category: session.metadata.category,
        transactionId: sessionId,
        paymentType: session.metadata.paymentType, // club-membership
        status: "paid",
        paidAt: new Date(),
      };

      // Save payment info if not already exists
      let savedPayment = await paymentCollection.findOne({ transactionId: sessionId });
      if (!savedPayment) {
        savedPayment = await paymentCollection.insertOne(paymentInfo);
        console.log("Payment saved:", savedPayment);
      } else {
        console.log("Payment already exists:", savedPayment);
      }

      // Prepare club membership record
      const clubMembership = {
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
        clubName: session.metadata.clubName || "",
        category: session.metadata.category,
        managerEmail: session.metadata.managerEmail,
        bannerImage: session.metadata.bannerImage,
        location: session.metadata.location,
        description: session.metadata.description,
        paymentId: session.payment_intent,
        status: "active",
        joinedAt: new Date(),
      };

      // Check if membership already exists
      let savedMembership = await clubMembershipCollection.findOne({
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
      });

      if (!savedMembership) {
        savedMembership = await clubMembershipCollection.insertOne(clubMembership);
        console.log("Club membership saved:", savedMembership);
      } else {
        console.log("Club membership already exists:", savedMembership);
      }

      return res.send({
        success: true,
        message: "Club membership payment saved successfully",
        paymentInfo,
        clubMembershipInfo: savedMembership,
      });
    }

    res.status(400).send({ success: false, message: "Payment not completed" });

  } catch (error) {
    console.error("Club Membership Payment Success Error:", error);
    res.status(500).send({
      success: false,
      message: "Error in club membership payment success API",
      error: error.message,
    });
  }
});










// ============================================ Admin Dashboard Data ========================================




// app.get('/admin-overview', async (req, res) => {
//   try {

//     // 1. USERS
//     const totalUsers = await usersCollection.countDocuments();

//     // 2. CLUBS
//     const totalClubs = await clubsCollection.countDocuments();
//     const pendingClubs = await clubsCollection.countDocuments({ status: "pending" });
//     const approvedClubs = await clubsCollection.countDocuments({ status: "approved" });
//     const rejectedClubs = await clubsCollection.countDocuments({ status: "rejected" });

//     // 3. MEMBERSHIPS
//     const totalMemberships = await clubMembershipCollection.countDocuments();

//     //  MEMBERSHIPS PER CLUB
//     const clubs = await clubsCollection.find().toArray();
//     const membershipsPerClub = await Promise.all(
//       clubs.map(async (club) => {
//         const count = await clubMembershipCollection.countDocuments({ clubId: club._id.toString() });
//         return {
//           clubName: club.name,
//           memberships: count,
//         };
//       })
//     );

//     // 4. EVENTS
//     const totalEvents = await eventsCollection.countDocuments();

//     // 5. EVENT REGISTRATIONS
//     const totalEventRegistrations = await eventRegistrationsCollection.countDocuments();

//     // 6. TOTAL PAYMENTS (AMOUNT SUM)
//     const paymentStats = await paymentCollection.aggregate([
//       { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
//     ]).toArray();

//     const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;
//     const totalPayments = paymentStats[0]?.count || 0;

//     // FINAL RESPONSE
//     res.send({
//       users: {
//         total: totalUsers
//       },
//       clubs: {
//         total: totalClubs,
//         pending: pendingClubs,
//         approved: approvedClubs,
//         rejected: rejectedClubs
//       },
//       memberships: {
//         total: totalMemberships
//       },
//       membershipsPerClub, // add memberships per club here
//       events: {
//         total: totalEvents
//       },
//       eventRegistrations: {
//         total: totalEventRegistrations
//       },
//       payments: {
//         totalPayments,
//         totalAmount: totalPaymentAmount
//       }
//     });

//   } catch (error) {
//     console.error("Admin Overview Error:", error);
//     res.status(500).send({ message: "Server Error" });
//   }
// });



app.get('/admin-overview', async (req, res) => {
  try {

    // 1. USERS
    const totalUsers = await usersCollection.countDocuments();

    // 2. CLUBS
    const totalClubs = await clubsCollection.countDocuments();
    const pendingClubs = await clubsCollection.countDocuments({ status: "pending" });
    const approvedClubs = await clubsCollection.countDocuments({ status: "approved" });
    const rejectedClubs = await clubsCollection.countDocuments({ status: "rejected" });

    // 3. MEMBERSHIPS
    const totalMemberships = await clubMembershipCollection.countDocuments();

    //  MEMBERSHIPS PER CLUB
    const clubs = await clubsCollection.find().toArray();
    const membershipsPerClub = await Promise.all(
      clubs.map(async (club) => {
        const count = await clubMembershipCollection.countDocuments({ clubId: club._id.toString() });
        return {
          clubName: club.name,
          memberships: count,
        };
      })
    );

    // 4. EVENTS
    const totalEvents = await eventsCollection.countDocuments();

    // 5. EVENT REGISTRATIONS
    const totalEventRegistrations = await eventRegistrationsCollection.countDocuments();

    // 6. TOTAL PAYMENTS (AMOUNT SUM)
    // Fix: convert amount to number and handle empty collection
    const paymentStats = await paymentCollection.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $toDouble: "$amount" } }, // ensure numeric sum
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;
    const totalPayments = paymentStats[0]?.count || 0;

    // FINAL RESPONSE
    res.send({
      users: { total: totalUsers },
      clubs: {
        total: totalClubs,
        pending: pendingClubs,
        approved: approvedClubs,
        rejected: rejectedClubs
      },
      memberships: { total: totalMemberships },
      membershipsPerClub,
      events: { total: totalEvents },
      eventRegistrations: { total: totalEventRegistrations },
      payments: {
        totalPayments,
        totalAmount: totalPaymentAmount
      }
    });

  } catch (error) {
    console.error("Admin Overview Error:", error);
    res.status(500).send({ message: "Server Error" });
  }
});


























// User get api
app.get('/users', async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result)
      // console.log(result);
    })

// User role change api 
app.patch('/users/:id/role', async (req, res) => {

  const id = req.params.id;
  const { role } = req.body;

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role } }
  );

  res.send({ modifiedCount: result.modifiedCount });
});




// app.patch('/users/:id/role', async (req, res) => {
//   const id = req.params.id;
//   const { role } = req.body;

//   let filter = {};

//   try {
//     filter = { _id: new ObjectId(id) };
//   } catch {
//     filter = { _id: id };  // fallback if id is string
//   }

//   const result = await usersCollection.updateOne(filter, {
//     $set: { role }
//   });

//   res.send({ modifiedCount: result.modifiedCount });
// });






    


// Payment get api:
app.get('/payments', async (req, res) => {
  try {
    const {
      userEmail,
      clubId,
      eventId,
      status,
      paymentType,
      minAmount,
      maxAmount,
      startDate,
      endDate
    } = req.query;

    let filter = {};

    // Filters
    if (userEmail) filter.userEmail = userEmail;
    if (clubId) filter.clubId = clubId;
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;

    // Amount range
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    // Date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Fetch and sort latest first
    const payments = await paymentCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(payments);

  } catch (error) {
    console.error("Payments Fetch Error:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
});








// ============================================ Club Manager Dashboard Data ========================================

// app.get('/club-manager-overview', async (req, res) => {
//   try {
//     const managerEmail = req.query.managerEmail;
//     const userRole = req.query.role; // example → "member"

//     if (!managerEmail) {
//       return res.status(400).send({ message: "managerEmail is required" });
//     }

//     // 1. FIND CLUBS MANAGED BY THIS MANAGER
//     const managedClubs = await clubsCollection
//       .find({ managerEmail })
//       .toArray();

//     const clubIds = managedClubs.map(c => c._id.toString());

//     const totalClubs = managedClubs.length;

//     // 2. FIND ALL MEMBERS IN THESE CLUBS
//     const clubMembers = await clubMembershipCollection
//       .find({ clubId: { $in: clubIds } })
//       .toArray();

//     const memberEmails = clubMembers.map(m => m.userEmail);

//     // 3. FILTER USERS BY ROLE (e.g. member / manager / admin)
//     let totalMembers = 0;

//     if (userRole) {
//       totalMembers = await usersCollection.countDocuments({
//         email: { $in: memberEmails },
//         role: userRole
//       });
//     } else {
//       totalMembers = memberEmails.length;
//     }

//     // 4. TOTAL EVENTS CREATED BY THESE CLUBS
//     const totalEvents = await eventsCollection.countDocuments({
//       clubId: { $in: clubIds }
//     });

//     // 5. TOTAL PAYMENTS FOR THESE CLUBS
//     const paymentStats = await paymentCollection.aggregate([
//       { $match: { clubId: { $in: clubIds }, status: "paid" } },
//       {
//         $group: {
//           _id: null,
//           totalAmount: { $sum: "$amount" },
//           totalPayments: { $sum: 1 }
//         }
//       }
//     ]).toArray();

//     const totalPayments = paymentStats[0]?.totalPayments || 0;
//     const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;

//     // FINAL RESPONSE
//     res.send({
//       managerEmail,
//       filterRole: userRole || "none",
//       clubs: {
//         total: totalClubs
//       },
//       members: {
//         total: totalMembers
//       },
//       events: {
//         total: totalEvents
//       },
//       payments: {
//         totalPayments,
//         totalAmount: totalPaymentAmount
//       }
//     });

//   } catch (error) {
//     console.error("Club Manager Overview Error:", error);
//     res.status(500).send({ message: "Server Error" });
//   }
// });





// club-manager-overview?managerEmail=ayansujonbd@gmail.com&role=manager
app.get('/club-manager-overview', async (req, res) => {
  try {
    const managerEmail = req.query.managerEmail;
    const filterRole = req.query.role; // optional (member/manager/etc.)

    if (!managerEmail) {
      return res.status(400).send({ message: "managerEmail is required" });
    }

    // STEP 1: Find clubs where this email is managerEmail
    const managedClubs = await clubsCollection.find({ managerEmail }).toArray();

    if (managedClubs.length === 0) {
      return res.status(404).send({ message: "No clubs found for this managerEmail" });
    }

    // STEP 2: Match email with users collection
    const managerUser = await usersCollection.findOne({ email: managerEmail });

    if (!managerUser) {
      return res.status(404).send({ message: "User not found in users collection" });
    }

    // STEP 3: Must be manager role
    if (managerUser.role !== "manager") {
      return res.status(403).send({
        message: "User found but role is not manager",
        foundRole: managerUser.role
      });
    }

    // Club IDs for further stats
    const clubIds = managedClubs.map(c => c._id.toString());

    // STEP 4: Members of these clubs
    const clubMembers = await clubMembershipCollection.find({
      clubId: { $in: clubIds }
    }).toArray();

    const memberEmails = clubMembers.map(m => m.userEmail);

    // Filter by role (optional)
    let totalMembers = 0;

    if (filterRole) {
      totalMembers = await usersCollection.countDocuments({
        email: { $in: memberEmails },
        role: filterRole
      });
    } else {
      totalMembers = memberEmails.length;
    }

    // Total events
    const totalEvents = await eventsCollection.countDocuments({
      clubId: { $in: clubIds }
    });

    // Payments
    const paymentStats = await paymentCollection.aggregate([
      { $match: { clubId: { $in: clubIds }, status: "paid" } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalPayments: { $sum: 1 } } }
    ]).toArray();

    const totalPayments = paymentStats[0]?.totalPayments || 0;
    const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;

    // FINAL RESPONSE
    res.send({
      manager: {
        email: managerEmail,
        name: managerUser.name,
        role: managerUser.role
      },
      clubs: {
        total: managedClubs.length
      },
      members: {
        total: totalMembers,
        filterRole: filterRole || "none"
      },
      events: {
        total: totalEvents
      },
      payments: {
        totalPayments,
        totalAmount: totalPaymentAmount
      }
    });

  } catch (error) {
    console.error("Club Manager Overview Error:", error);
    res.status(500).send({ message: "Server Error" });
  }
});









// /clubs-managed?managerEmail=ayansujonbd@gmail.com&role=manager
app.get('/my-clubs', async (req, res) => {
  try {
    const managerEmail = req.query.managerEmail;

    if (!managerEmail) {
      return res.status(400).send({ message: "managerEmail is required" });
    }

    // STEP 1: Find manager user
    const managerUser = await usersCollection.findOne({ email: managerEmail });

    if (!managerUser) {
      return res.status(404).send({ message: "User not found" });
    }

    if (managerUser.role !== "clubManager") {
      return res.status(403).send({
        message: "User found but role is not manager",
        foundRole: managerUser.role
      });
    }

    // STEP 2: Find all clubs managed by this manager
    const managedClubs = await clubsCollection.find({ managerEmail }).toArray();

    if (!managedClubs.length) {
      return res.status(404).send({ message: "No clubs found for this managerEmail" });
    }

    // FINAL RESPONSE: return only clubs
    res.send({
      manager: {
        email: managerEmail,
        name: managerUser.name,
        role: managerUser.role
      },
      clubs: managedClubs
    });

  } catch (error) {
    console.error("Club Manager Overview Error:", error);
    res.status(500).send({ message: "Server Error" });
  }
});













// GET SINGLE CLUB BY ID (Optional: Manager Only)
app.get("/clubs/:id", async (req, res) => {
  try {
    const clubId = req.params.id; // Club ID from URL
    const managerEmail = req.query.email; // Optional: manager email query param

    if (!clubId) {
      return res.status(400).json({
        success: false,
        message: "Club ID is required",
      });
    }

    // If you want to restrict access to manager only
    if (!managerEmail) {
      return res.status(400).json({
        success: false,
        message: "Manager email query parameter is required",
      });
    }

    // 1️⃣ Find the club
    const club = await clubsCollection.findOne({ _id: new ObjectId(clubId) });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
      });
    }

    // 2️⃣ Optional: verify if the requester is the manager
    if (club.managerEmail !== managerEmail) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this club",
      });
    }

    // 3️⃣ Return the club
    res.status(200).json({
      success: true,
      data: club,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});







// API: GET /club-members
app.get('/club-members', async (req, res) => {
  try {
    const { managerEmail, role } = req.query;

    if (!managerEmail || !role) {
      return res.status(400).json({ success: false, message: 'managerEmail and role are required' });
    }

    // Check if user exists and role is manager
    const user = await usersCollection.findOne({ email: managerEmail, role: role });

    // if (!user) {
    //   return res.status(403).json({ success: false, message: 'Unauthorized or user not found' });
    // }

    // Fetch club memberships managed by this manager
    const memberships = await clubMembershipCollection.find({ managerEmail }).toArray();

    res.status(200).json({ success: true, data: memberships });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});







// PATCH /club-members/:id/expire
app.patch("/club-members/:id/expire", async (req, res) => {
  try {
    const { id } = req.params;
    const { expireDate } = req.body;

    if (!expireDate) {
      return res.status(400).json({ success: false, message: "expireDate is required" });
    }

    const expireDateObj = new Date(expireDate);
    const now = new Date();

    // Determine the status based on expire date
    const status = expireDateObj < now ? "expired" : "active";

    const result = await clubMembershipCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { expireDate: expireDateObj, status } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    res.status(200).json({ success: true, message: "Membership expiration updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




// DELETE /club-members/:id
app.delete("/club-members/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await clubMembershipCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    res.status(200).json({ success: true, message: "Membership deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});





// Events Management related api 

// GET /events?managerEmail=ayansujonbd@gmail.com
app.get("/events", async (req, res) => {
  const { managerEmail } = req.query;

  if (!managerEmail) {
    return res.status(400).json({ message: "managerEmail query is required" });
  }

  try {
    const events = await eventsCollection
      .find({ managerEmail: managerEmail })
      .toArray(); // collection থেকে array আকারে আনা

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch events", error: err });
  }
});







// /event-registrations?managerEmail=ayansujonbd@gmail.com&role=manager
  app.get('/event-registrations', async (req, res) => {
      const { managerEmail, role } = req.query;

      if (!managerEmail || !role) {
        return res.status(400).json({ message: 'managerEmail and role are required' });
      }

      // Check if user exists and has role "manager"
      const manager = await usersCollection.findOne({ email: managerEmail, role: role });
      if (!manager) {
        return res.status(403).json({ message: 'Access denied. Not a manager.' });
      }

      // If manager exists, get all event registrations
      const registrations = await eventRegistrationsCollection
        .find({})
        .project({ _id: 0, userEmail: 1, status: 1, registeredAt: 1 }) // only show required fields
        .toArray();

      res.json(registrations);
    });









// ===========================================( Member Overview ) ==============================================



app.get("/member-overview", async (req, res) => {
  try {
    const { userEmail, role } = req.query;

    if (!userEmail || !role) {
      return res.status(400).json({ error: "Missing userEmail or role" });
    }

    // Verify user
    const user = await db.collection("users").findOne({ email: userEmail, role });
    if (!user) {
      return res.status(403).json({ error: "Unauthorized or user not found" });
    }

    // Get event registrations for this user
    const registrations = await db
      .collection("eventRegistrations")
      .find({ userEmail })
      .toArray();

    const totalEventsRegistered = registrations.length;

    // Get unique clubIds from registrations (as numbers/strings)
    const uniqueClubIds = [...new Set(registrations.map((r) => r.clubId))];

    // Find clubs whose "clubId" matches (use your clubId field in clubs)
    const clubs = await db
      .collection("clubs")
      .find({ clubId: { $in: uniqueClubIds.map((id) => Number(id)) } })
      .toArray();

    const totalClubsJoined = clubs.length;

    // Get upcoming events from these clubs
    const upcomingEvents = await db
      .collection("events")
      .find({
        clubId: { $in: uniqueClubIds.map((id) => Number(id)) },
        eventDate: { $gte: new Date() },
      })
      .project({ title: 1, eventDate: 1, location: 1, clubId: 1 })
      .toArray();

    // Map clubName
    const eventsWithClubName = upcomingEvents.map((event) => {
      const club = clubs.find((c) => Number(c.clubId) === Number(event.clubId));
      return {
        title: event.title,
        date: event.eventDate,
        location: event.location,
        clubName: club ? club.clubName : "",
      };
    });

    res.json({
      totalClubsJoined,
      totalEventsRegistered,
      upcomingEvents: eventsWithClubName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});










// My Clubs API
// http://localhost:3000/member/my-clubs?userEmail=ayansujonbd@gmail.com&role=member

// API endpoint to get user's clubs
app.get('/member/my-clubs', async (req, res) => {
  try {
    const { userEmail,  role} = req.query;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    // Fetch memberships for this user
    const clubs = await clubMembershipCollection.find({ userEmail }).toArray();

    res.json(clubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


// API endpoint to get user's events
app.get('/member/my-events', async (req, res) => {
  try {
    const { userEmail,  role} = req.query;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    // Fetch memberships for this user
    const clubs = await eventRegistrationsCollection.find({ userEmail }).toArray();

    res.json(clubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to get user's payments
app.get('/member/my-payments', async (req, res) => {
  try {
    const { userEmail,  role} = req.query;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    // Fetch memberships for this user
    const clubs = await paymentCollection.find({ userEmail }).toArray();

    res.json(clubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
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
