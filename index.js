const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


function verifyJWT(req, res, next){
  const authoHeader = req.headers.authorization;
  if(!authoHeader){
      return res.status(401).send({message: 'unauthorized access'});
  }
  const token = authoHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) =>{
      if(err){
          return res.status(403).send({message:'forbidden access'});
      }
      console.log('decoded', decoded);
      req.decoded = decoded;
      next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wij4k.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run(){
  try{
    await client.connect();
    const servicesCollection = client.db('doctorsPortal').collection('services');
    const bookingCollection = client.db('doctorsPortal').collection('patient');
    const userCollection = client.db('doctorsPortal').collection('users');
    const doctorCollection = client.db('doctorsPortal').collection('doctors');

    const verifyAdmin = async(req, res, next) =>{
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});
      if(requesterAccount.role === 'admin'){
        next();
      } else{
        res.status(403).send({message:'forbidden'});
      }
    }

    app.get('/service', async(req, res)=>{
      const query = {};
      const cursor = servicesCollection.find(query).project({title:1});
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get('/available', async(req, res) =>{
      const date = req.query.date;
      // get all data 
      const services = await servicesCollection.find().toArray();
      // according to date, get data 
      const query = {date:date}; 
      const bookings = await bookingCollection.find(query).toArray();

      services.forEach(service =>{
        const serviceBookings = bookings.filter(book => book.treatment === service.title);
        const bookedSlots = serviceBookings.map(book =>book.slot);
        const available = service.slots.filter(slot =>!bookedSlots.includes(slot));
        service.slots = available;
      });
      res.send(services);
    });

     // get users 
     app.get('/user', async(req, res)=>{
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get('/admin/:email', async(req, res)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email:email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin});
    })

    app.put('/user/admin/:email', async(req, res)=>{ //verifyJWT, verifyAdmin,
        const email = req.params.email;
        const filter = {email:email};
        const updateDoc = {
          $set:{role:'admin'},
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    app.put('/user/:email', async(req, res)=>{
      const email =req.params.email;
      const user = req.body;
      const filter = {email:email};
      const option = {upsert:true};
      const updateDoc = {
        $set:user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({result, token});
    })

    // show data at dashboard
    app.get('/patient',  async(req, res)=>{//verifyJWT, verifyAdmin,
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if(patient === decodedEmail){
        const query = {patient:patient};
        const patientBooking = await bookingCollection.find(query).toArray();
        res.send(patientBooking); 
      } else{
        return res.status(403).send({message:'forbidden access'});
      }
    });

    // booking post 
    app.post('/booking', async (req, res)=>{
      const booking = req.body;
      const query = {
        treatment: booking.treatment, 
        date: booking.date, 
        patient: booking.patient
      };
      const exists = await bookingCollection.findOne(query);
      if(exists){
        return res.send({success:false, booking: exists});
      }
      const result = await bookingCollection.insertOne(booking);
     return res.send({success: true, result});
  });

  // add doctors
  app.post('/doctor', async (req, res)=>{ //verifyJWT, verifyAdmin,
    const doctor = req.body;
    const result = await doctorCollection.insertOne(doctor);
    res.send(result);
  });

  app.delete('/doctor/:email', async (req, res)=>{//verifyJWT, verifyAdmin,
    const email = req.params.email;
    const filter = {email:email};
    const result = await doctorCollection.delete(filter);
    res.send(result);
  })

  // get doctors
  app.get('/doctor', async(req, res)=>{//verifyJWT, verifyAdmin,
    // const doctors = await doctorCollection.find().toArray(); // one line
    const query = {};
      const cursor = doctorCollection.find(query);
      const doctors = await cursor.toArray();
      res.send(doctors);
  })




  }
  finally{

  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('This is server running');
});

app.listen(port, ()=>{
    console.log('My server is running', port);
})


