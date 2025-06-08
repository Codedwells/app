# Social Platform

Social is a modern social media platform designed to provide personalized content recommendations and seamless user interactions.

## Features

- **Personalized Recommendations**: AI-powered recommendations for timeline, explore, and follow suggestions.
- **Post View Tracking**: Tracks posts users have seen to avoid showing duplicate content.
- **Infinite Scroll**: Smooth infinite scrolling for timeline and explore pages.
- **User Profiles**: View and manage user profiles with posts and follower details.
- **Content Categorization**: Posts categorized by user interests for better discovery.
- **Authentication**: Secure login and user management.
- **Dockerized Environment**: Simplifies development and deployment with Docker.
- **TypeScript Support**: Ensures type safety and modern JavaScript features.

## Project Structure

```
├── app.ts
├── dev.sh
├── docker-compose.override.yml
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.dev
├── package.json
├── pnpm-lock.yaml
├── prod.sh
├── README.md
├── tsconfig.json
├── algorithm/
│   ├── app/
│   │   ├── main.py
│   │   ├── model.py
│   │   ├── utils.py
├── app/
│   ├── controllers/
│   ├── lib/
│   ├── middleware/
│   ├── models/
│   ├── public/
│   ├── router/
│   ├── services/
│   ├── scripts/
```

## Getting Started

### Prerequisites

- Node.js
- Docker
- Python 3.11+

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-repo/social-recommender.git
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   - Create a `.env` file in the root directory.
   - Add necessary configurations for MongoDB, Python service, and other dependencies.

4. Start the services:

   ```bash
   docker-compose up --build
   ```

## Key Endpoints

### Node.js API

- `/timeline`: Fetches the user's timeline with personalized recommendations.
- `/ai/explore`: Provides AI-powered explore page recommendations.
- `/ai/users/recommended`: Suggests users to follow based on interests and connections.
- `/user/seen-posts`: Tracks and manages posts seen by the user.

### Python Service

- `/recommend/timeline/{user_id}`: AI recommendations for the timeline.
- `/recommend/explore/{user_id}`: AI recommendations for the explore page.
- `/recommend/users/{user_id}`: AI-powered follow suggestions.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
