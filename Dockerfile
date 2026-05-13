# Use official Node.js image with lightweight Debian base
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies omitting devDependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Ensure the app starts with the command defined in package.json
CMD [ "npm", "start" ]