<div align="center">

# ⚖️ Advokate Server
### Secure REST API for the Advokate Lawyer Hiring Platform

<p align="center">
A robust Express.js backend powering the Advokate platform with secure authentication, role-based authorization, Stripe payment processing, MongoDB integration, and RESTful APIs.
</p>

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb)
![Stripe](https://img.shields.io/badge/Stripe-Payment-635BFF?style=for-the-badge&logo=stripe)
![BetterAuth](https://img.shields.io/badge/BetterAuth-Authentication-green?style=for-the-badge)

</div>

---

# 🌐 Live Demo

### 🔗 Client Application

https://advokate-client.vercel.app/

### 🔗 Server API

https://advokate-server.vercel.app/

---

# 📂 Source Code

[![Client Repository](https://img.shields.io/badge/Client-Repository-181717?style=for-the-badge&logo=github)](https://github.com/rohan-bhau/Advokate-client)

[![Server Repository](https://img.shields.io/badge/Server-Repository-181717?style=for-the-badge&logo=github)](https://github.com/rohan-bhau/Advokate-server)

---

# 📖 Project Overview

Advokate Server is the backend service for the Advokate platform. It provides secure REST APIs for authentication, role-based authorization, lawyer management, hiring workflows, payment processing, reviews, transactions, and administrative operations.

The backend follows a scalable RESTful architecture using Express.js and MongoDB while integrating Better Auth for authentication and Stripe for secure online payments.

---

# 🚀 Core Features

## 🔐 Authentication

- Better Auth Authentication
- Google Authentication
- Email & Password Login
- JWT Session Validation
- Secure Cookie Handling
- Protected API Routes

---

## 👤 User APIs

- Register & Login
- Profile Management
- Browse Lawyers
- Send Hiring Requests
- Hiring History
- Stripe Payment
- Transaction History
- Review Lawyers
- Update Reviews
- Delete Reviews

---

## ⚖️ Lawyer APIs

- Dashboard Overview
- Create Legal Profile
- Update Legal Profile
- Delete Legal Profile
- Accept Hiring Requests
- Reject Hiring Requests
- Mark Case as Won
- View Transactions
- View Hiring History
- One-Time Verification Payment

---

## 👑 Admin APIs

- Dashboard Analytics
- Manage Users
- Change User Roles
- Delete Users
- Approve Lawyer Profiles
- Reject Lawyer Requests
- Publish Services
- Unpublish Services
- View All Transactions
- Monitor Verification Payments

---

# 💳 Payment Workflow

1. User submits a hiring request.
2. Lawyer reviews the request.
3. Lawyer accepts or rejects the request.
4. Accepted requests unlock Stripe payment.
5. Payment is securely processed.
6. Transaction is stored in MongoDB.
7. User becomes eligible to submit a review.
8. Lawyers pay a one-time $149 verification fee to publish legal services.

---

# 🔒 Security Features

- Role-Based Authorization
- Better Auth Middleware
- Protected API Routes
- Secure Environment Variables
- MongoDB Connection Security
- Input Validation
- Error Handling
- Secure Stripe Payment Processing

---

# 🛠 Tech Stack

## Backend

- Node.js
- Express.js
- MongoDB

## Authentication

- Better Auth
- JWT

## Payment

- Stripe

## Image Storage

- imgBB API

---

# 📦 Main Packages

- express
- mongodb
- better-auth
- @better-auth/mongo-adapter
- stripe
- dotenv
- cors
- cookie-parser

---

# 🗂 Database Collections

- users
- lawyers
- legalProfiles
- hireRequests
- reviews
- transactions
- payments

---

# 📁 Project Structure

```bash
server
│
└── index.js
```

---

# 🔑 Environment Variables

Create a `.env` file.

```env
PORT=5000

MONGODB_URI=YOUR_MONGODB_URI

```

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/rohan-bhau/Advokate-server.git
```

Navigate into the project

```bash
cd Advokate-server
```

Install dependencies

```bash
npm install
```

Run development server

```bash
npm run dev
```

Start production server

```bash
npm start
```

---

# 📡 REST API Modules

### Authentication

- User Registration
- User Login
- Google Login
- Session Verification

### Users

- Profile Management
- Hiring History
- Transactions

### Lawyers

- Legal Profile CRUD
- Hiring Requests
- Dashboard Statistics

### Reviews

- Create Review
- Update Review
- Delete Review

### Payments

- Stripe Checkout
- Payment Verification
- Transaction Records

### Admin

- User Management
- Role Management
- Lawyer Approval
- Analytics
- Transactions

---

# 📊 Platform Workflow

```text
User
   │
   ▼
Browse Lawyers
   │
   ▼
Send Hiring Request
   │
   ▼
Lawyer Accepts
   │
   ▼
Stripe Payment
   │
   ▼
Transaction Stored
   │
   ▼
Hiring Completed
   │
   ▼
Review Lawyer
```

---

# 🎯 Future Improvements

- Real-time Notifications
- Email Service
- Video Consultation
- Chat System
- AI Legal Assistant
- Calendar Booking
- Multi-language Support
- API Rate Limiting
- Logging & Monitoring

---

# 👨‍💻 Author

## MD Rohan Mia

**MERN Stack Developer**

### GitHub

https://github.com/rohan-bhau

---

# ⭐ Support

If you found this project useful, consider giving the repositories a ⭐ on GitHub.

---

<div align="center">

### Built with ❤️ using Node.js, Express.js, MongoDB, Better Auth & Stripe

</div>
