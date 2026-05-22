# Campus-event-Finder-and-Manager
📌 Event Manager Backend  Event Manager is a full-featured backend built with Node.js, Express.js, and MongoDB (Mongoose) for managing events in a college, club, or community. It supports role-based access with admins and users, secure authentication, event registration, and dynamic event filtering. 

⚡ Features
JWT Authentication: Secure login and registration for users and admins
Role-Based Access Control:
Admin → create, update, delete events
User → view and register for events
Event Management:
Events have title, description, type (hackathon, tech, seminar, games, movie, other), date, time, registration deadline, and location
Admins can manage events
User Registration:
Users can register for events
Duplicate registrations are prevented
Admins can view registrations per event
Filtering, Search & Sorting:
Filter events by type
Search events by title
Sort by nearest registration deadline
Middleware:
JWT authentication
Role-based authorization
Validation & Error Handling: Using express-validator
Async/Await & Modular Code: Clean, scalable, production-ready

🧪 Tech Stack
Backend: Node.js, Express.js
Database: MongoDB (Mongoose)
Authentication: JWT, bcrypt
Validation: express-validator
Environment Config: dotenv
