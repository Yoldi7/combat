# Tank Combat - Multiplayer Game

A real-time multiplayer tank combat game using PixiJS and WebSockets with binary protocol.

## Features

- **Real-time multiplayer** with WebSocket TCP connections
- **Binary protocol** for efficient network communication
- **Menu system** for player name and server connection
- **Smooth tank movement** with WASD controls
- **Turret rotation** with arrow keys
- **Bullet firing** with space bar
- **Wall collision** with sliding mechanics
- **Bullet bouncing** off walls

## Installation

```bash
npm install
```

## Running the Game

### Option 1: Run both server and client together
```bash
npm run dev:all
```

### Option 2: Run separately

**Terminal 1 - Start the server:**
```bash
npm run server
```

**Terminal 2 - Start the client:**
```bash
npm run dev
```

## How to Play

1. Open your browser to `http://localhost:5173` (or the URL shown by Vite)
2. Enter your player name
3. Ensure server URL is `ws://localhost:8080` (default)
4. Click "Play" to join the game
5. Wait for other players to join

### Controls
- **WASD** - Move tank
- **Arrow Left/Right** - Rotate turret
- **Space** - Fire bullet

## Playing on Local Network

To play with others on your local network:

1. Find your local IP address:
   - **Linux**: `ip addr show` or `hostname -I`
   - **Windows**: `ipconfig`
   - **Mac**: `ifconfig`

2. Start the server and note your IP (e.g., `192.168.1.100`)

3. Other players should:
   - Open `http://YOUR_IP:5173`
   - Use server URL: `ws://YOUR_IP:8080`

## Network Protocol

The game uses a binary protocol over WebSockets for efficiency:

### Message Types
- **Client to Server:**
  - `0x01` JOIN - Player joins with name
  - `0x02` PLAYER_INPUT - Tank position and rotation
  - `0x03` FIRE_BULLET - Bullet fired

- **Server to Client:**
  - `0x10` JOIN_SUCCESS - Player ID assigned
  - `0x11` GAME_STATE - All player positions (30 Hz)
  - `0x12` PLAYER_JOINED - New player notification
  - `0x13` PLAYER_LEFT - Player disconnected
  - `0x14` BULLET_FIRED - Bullet spawned
  - `0x15` BULLET_DESTROYED - Bullet expired

### Data Format
- Position: Float32 (4 bytes)
- Rotation: Float32 (4 bytes)
- Player ID: Uint32 (4 bytes)
- Bullet ID: Uint32 (4 bytes)

## Project Structure

```
combat/
├── server/
│   └── server.js          # WebSocket game server
├── src/
│   ├── main.js            # Game client entry point
│   ├── Tank.js            # Tank class
│   ├── Bullet.js          # Bullet class
│   ├── Wall.js            # Wall class
│   └── NetworkManager.js  # Network communication
├── public/
│   ├── menu.html          # Main menu
│   └── game.html          # Game page
└── package.json
```

## Development

- Server runs on port **8080**
- Client dev server runs on port **5173** (Vite default)
- Game updates at **30 Hz** server tick rate
- Bullets expire after **5 seconds**

## Troubleshooting

- **Cannot connect to server**: Make sure the server is running (`npm run server`)
- **Port already in use**: Change the port in `server/server.js`
- **Firewall blocking**: Allow ports 8080 and 5173 through your firewall
- **Network play not working**: Ensure all devices are on the same network and firewall allows incoming connections

## Future Enhancements

- Player health and damage system
- Respawn mechanism
- Score tracking
- Different tank types
- Power-ups
- Minimap
- Chat system
