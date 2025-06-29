# Commercial Bank Project

## Project Structure

Commercial Bank Project Structure:

```
commercial-bank/
├── server/                  # Backend server
│   ├── node_modules/        # Node.js dependencies
│   ├── src/                 # Source code
│   │   ├── config/          # Configuration files
│   │   ├── middlewares/     # Express middlewares
│   │   ├── queries/         # Database queries
│   │   ├── routes/          # API route definitions
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   ├── app.ts           # Express app configuration
│   │   └── server.ts        # Server entry point
│   └── package.json         # Backend dependencies and scripts
│
├── frontend/                # Frontend React application
│   ├── node_modules/        # Node.js dependencies
│   ├── public/              # Static assets
│   └── src/                 # Source code
│       ├── components/      # React components
│       ├── services/        # API service calls
│       ├── types/           # TypeScript type definitions
│       ├── utils/           # Utility functions
│       ├── views/           # Page components
│       ├── App.css          # Main styles
│       ├── App.tsx          # Root component
│       ├── index.css        # Global styles
│       ├── main.tsx         # Application entry point
│       └── vite-env.d.ts    # Vite type definitions
│
├── flyway/                  # Database migrations
├── terraform/               # Infrastructure as code
└── README.md                # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- TypeScript
- PostgreSQL

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd commercial-bank
   ```

2. Install backend dependencies:
   ```bash
   cd server
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
### Running the Server

#### 🧪 Development

   From the `server` directory:

   ```bash
   npm run dev
   ```

   > Make sure you have a `.env.development` file present in the root of the `server` directory.

---

#### 🛠 Build

To compile the backend TypeScript files:

```bash
npm run build
```

---

#### 🚢 Production

To run the backend in production mode:

```bash
npm start
```

> Ensure a `.env.production` file exists in the `server` directory before starting the app.

### Running the Frontend Application

From the `frontend` directory:
```bash
npm run dev
```
This will start the Vite development server.

To build for production:
```bash
npm run build
```
## Contributing

We welcome contributions! Please follow our contribution guidelines:
1. Check our tickets to verify that no one is working on the fix or feature you are trying to add
2. Create the ticket with a clear explanation of its intention
3. Contact the maintainers with a link to the ticket
4. Create a new branch for your your-name/what-you-where-fixing-or-adding
5. Test your changes
6. Submit a pull request with a clear description of your changes
7. Great thanks for your contribution

For any questions, please reach out to the project maintainers.