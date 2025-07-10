# **Collaborative Document Service**

This repository contains the code for a real-time collaborative document editing **microservice**, leveraging the powerful capabilities of [Hocuspocus](https://hocuspocus.dev/) for the collaborative backend.

## **🚀 Overview**

This microservice enables and supports real-time co-editing of various types of documents and data. Changes made by one user are instantly synchronized and reflected for all other active users, ensuring a smooth and efficient collaborative workflow across diverse data structures, not limited to just text fields.

## **✨ Features**

* **Real-time Collaboration:** Instant synchronization of edits across multiple users for various data types.
* **Awareness / Presencing:** Users can see who else is currently viewing or editing the document, including their cursor positions, selections, and online status, fostering a more interactive and coordinated collaborative environment.
* **Robust Backend:** Utilizes Hocuspocus for efficient WebSocket-based communication and conflict resolution.
* **Scalable Architecture:** Designed as a microservice to handle multiple concurrent users and documents efficiently.
* **Flexible Data Support:** Enables collaboration on a wide range of data structures beyond just rich text.
* **Persistence (Optional/Configurable):** Easily extendable to save document states to a database for long-term storage.

## **🛠️ Technologies Used**

* **Backend (Microservice):**
    * [Hocuspocus Server](https://hocuspocus.dev/): A WebSocket-based backend for real-time collaboration.
    * [Node.js](https://nodejs.org/): JavaScript runtime environment.
    * [NestJS 11](https://nestjs.com/): A progressive Node.js framework for building efficient, reliable and scalable server-side applications.
    * [Fastify](https://www.fastify.io/) (Optional, for API endpoints or serving static files): A fast and low overhead web framework for Node.js.
    * [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API): For real-time communication.
* **Frontend (Client-side integration):**
    * [Hocuspocus Client](https://tiptap.dev/docs/hocuspocus/guides/collaborative-editing): The client-side library for connecting to the Hocuspocus server.
    * (Assumed: A modern JavaScript framework like React, Vue, or plain JavaScript for the UI, integrating with the Hocuspocus client for collaboration)

## **📦 Getting Started**

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### **Prerequisites**

Make sure you have Node.js and npm (or yarn) installed:

* [Node.js](https://nodejs.org/en/download/) (LTS version recommended)
* npm (comes with Node.js) or [Yarn](https://yarnpkg.com/getting-started/install)

### **Installation**

1. **Clone the repository:**  
   ```
   git clone https://github.com/your-username/collaborative-document-service.git  
   cd collaborative-document-service
   ```

2. Install backend dependencies:  
   Navigate to the project and install dependencies:  
   ```
   npm install \# or yarn install
   ```

### **Running the Service**

1. Start the Hocuspocus Server (Microservice):  
   From this project directory:  
   ```
   npm run start
   ```

   The server will usually run on `ws://localhost:1234` by default, but check your server configuration.

## **⚙️ Configuration**

You might need to configure environment variables for the server (e.g., port, database connection strings) or the client (e.g., Hocuspocus server URL). Refer to the .env.example files (if present) or the specific configuration files in the backend and frontend directories.

## **🤝 Contributing**

Contributions are welcome\! If you have suggestions for improvements or new features, please feel free to:

1. Fork the repository.
2. Create a new branch (git checkout \-b feature/AmazingFeature).
3. Make your changes.
4. Commit your changes (git commit \-m 'Add some AmazingFeature').
5. Push to the branch (git push origin feature/AmazingFeature).
6. Open a Pull Request.

## **📄 License**

This project is licensed under the [EUPL-1.2 License](https://www.google.com/search?q=EUPL-1.2).
