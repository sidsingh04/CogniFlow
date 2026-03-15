# OmniSync 2

## Overview

OmniSync 2 is a modern, real-time ticketing and support agent management system designed to streamline operations between Support Agents and Supervisors. Built with a robust full-stack architecture, it ensures seamless communication, efficient ticket resolution workflows, and comprehensive oversight capabilities.

## Key Features

- **Role-Based Access Control**: Secure JWT-based authentication for both Agents and Supervisors ensuring protected API layers.
- **Enhanced UI & Dashboards**: Dedicated intuitive user interfaces for easy access by Agents and Supervisors, enabling supervisors to monitor agents and agents to seamlessly manage availability, tickets, and multi-stage approvals.
- **SLA Analytics & Data Visualization**: Extensible charting modules utilizing Recharts to track global metrics, Service Level Agreement (SLA) analytics, and operational performance.
- **Real-Time Live Updates**: Integrated WebSockets for live status and activity updates across the application, keeping agents and supervisors in sync instantaneously.
- **Advanced Ticket Workflow**: End-to-end ticket lifecycle management, including creation, approval routing, tracking, and agent closing reviews.

## Knowledge Base (KB) Focus & Self-Learning System

OmniSync 2 places a heavy emphasis on a dynamic, self-learning Knowledge Base (KB) to optimize support efficiency:

- **Customer Search Workflow**: Customers can search the knowledge base for solutions before or while raising a ticket, receiving contextually relevant articles based on optimized search logic and confidence scores.
- **Self-Learning Capabilities**: The KB actively learns from interactions. It automatically suggests top-rated solutions/articles for high-confidence queries, or intelligently directs the user to the human helpline for low-confidence searches. This drastically reduces the load on agents by empowering customers to solve redundant problems themselves.
- **Agent Efficiency**: Agents benefit from the system automatically suggesting helpful solutions directly during ticket resolution, significantly speeding up response times.
- **Closing Reviews & KB Crowdsourcing**: Upon resolving a ticket, agents are prompted to add a closing review. These reviews contribute to generating new KB articles, continually expanding the repository with real-world solutions.
- **Tag Management & Performance Optimization**: To prevent KB bloating and negatively impacting search performance, the insertion of new articles and tags is strictly controlled. Tags maintain specific statuses, and a dedicated periodic Cron Job automatically cleans up "noisy" or pending tags, ensuring that the database remains clean and search accuracy remains incredibly high.

## Tech Stack

### Frontend
- **Framework**: React 19 (TypeScript), Vite
- **Styling**: Tailwind CSS v4, implementation of Radix UI components (Shadcn)
- **Routing**: React Router DOM
- **Data Visualization**: Recharts
- **Icons**: Lucide React
- **HTTP/API Client**: Axios

### Backend & Infrastructure
- **Runtime**: Node.js
- **API Framework**: Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Authentication**: Passport.js (JWT Strategy), bcrypt
- **Real-Time Updates**: WebSockets (Socket.io)
- **Cloud & Queue Services**: AWS S3 (Robust Blob Storage) and AWS SQS (Message Queuing for optimized background processing)
- **Automation**: Cron Jobs (Autonomous database cleanup and tag management)

## Getting Started

### Prerequisites

- Node.js (v18+ or higher recommended)
- Running MongoDB instance (Local or Atlas)

### Installation

1. Navigate to the project directory:
   ```bash
   cd omnisync_2
   ```

2. **Backend Setup**:
   ```bash
   cd Backend
   npm install
   ```
   *Create a `.env` file in the `Backend` directory and define the required environment variables (e.g., `PORT`, `MONGO_URI`, `JWT_SECRET`).*

3. **Frontend Setup**:
   ```bash
   cd Frontend
   npm install
   ```
   *Create a `.env` file in the `Frontend` directory if there are client-side variables needed (e.g., `VITE_API_BASE_URL`).*

### Running the Application

To run the application locally, you will need to start both the frontend and backend servers.

1. **Start the Backend Server**:
   ```bash
   cd Backend
   npx nodemon index.js
   ```
   *This starts the server on your configured port (typically 5000 or 8080) using nodemon.*

2. **Start the Frontend Development Server**:
   ```bash
   cd Frontend
   npm run dev
   ```



