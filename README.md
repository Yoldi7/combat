# Tank Combat - Multiplayer Game

A real-time multiplayer tank combat game using PixiJS and WebSockets with a custom binary protocol.

## Features

- **Real-time multiplayer** - 2-player matches with WebSocket communication
- **Binary protocol** - Efficient network communication with custom message format
- **Dynamic IP detection** - Automatically detects server IP for LAN play
- **Menu system** - Player name and server connection setup
- **Smooth tank movement** - WASD controls with collision detection
- **Turret rotation** - Independent turret control with arrow keys
- **Server-driven physics** - All bullet movement and collision on server
- **Health system** - 3 lives per player with visual health indicators
- **Wall collision** - Sliding mechanics and bullet bouncing
- **Game Over screen** - Stats tracking (kills/deaths) and main menu return

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
3. The server URL will be auto-detected (default: `ws://localhost:8090`)
4. Click "Play" to join the lobby
5. Wait for another player to join (2/2 players required)
6. Game starts automatically when both players are ready

### Controls
- **W/A/S/D** - Move tank (forward/left/backward/right)
- **Arrow Left/Right** - Rotate turret independently
- **Space** - Fire bullet (server-side physics)

### Game Mechanics
- **3 lives per player** - Displayed as hearts at top of screen
- **Hit detection** - Bullets check collision with rotated tank hitboxes
- **Bullet bouncing** - Bullets bounce off walls and obstacles
- **5-second bullet lifetime** - Bullets expire automatically
- **No friendly fire grace period** - 500ms protection from own bullets

## Playing on Local Network

To play with others on your local network (LAN):

### Server Setup

1. **Find your local IP address:**
   - **Linux**: `hostname -I` or `ip addr show`
   - **Windows**: `ipconfig` (look for IPv4 Address)
   - **Mac**: `ifconfig en0` (look for inet)

2. **Open firewall port for WebSocket server:**
   ```bash
   # Linux (UFW)
   sudo ufw allow 8090/tcp
   sudo ufw reload
   
   # Check status
   sudo ufw status
   ```

3. **Start the server:**
   ```bash
   npm run dev:all
   ```
   - Frontend (Vite) will be on port 5173
   - WebSocket server will be on port 8090

### Client Setup

1. **Access from another device on the same network:**
   - Use: `http://YOUR_SERVER_IP:5173`
   - Example: `http://192.168.1.143:5173`

2. **The game automatically detects the server IP:**
   - If you access via `http://192.168.1.143:5173`
   - It will connect to `ws://192.168.1.143:8090`

3. **Manual server URL (if needed):**
   - You can manually edit the server URL in the menu
   - Format: `ws://IP_ADDRESS:8090`

### Important Notes
- **Same network required** - All players must be on the same LAN/WiFi
- **Firewall must allow port 8090** - For WebSocket connections
- **Server must bind to 0.0.0.0** - Already configured in `server.js`
- **Use `--host` flag** - Run `npm run dev -- --host` to expose Vite to network

## Network Protocol

The game uses a **custom binary protocol** over WebSockets for efficient real-time communication. All messages use big-endian byte order.

### Message Types

#### Client → Server Messages

| Code | Name | Description | Payload |
|------|------|-------------|---------|
| `0x01` | JOIN | Player joins the lobby | `[1:nameLength][N:name]` |
| `0x02` | PLAYER_INPUT | Tank position/rotation update | `[4:x][4:y][4:hullRot][4:turretRot]` |
| `0x03` | FIRE_BULLET | Request to fire a bullet | `[4:x][4:y][4:rotation][4:vx][4:vy]` |
| `0x04` | READY_FOR_REMATCH | Player ready for new game | No payload |

#### Server → Client Messages

| Code | Name | Description | Payload |
|------|------|-------------|---------|
| `0x10` | JOIN_SUCCESS | Connection accepted, ID assigned | `[4:playerId]` |
| `0x11` | GAME_STATE | All player positions (30 Hz) | `[4:count]` + `[4:id][4:x][4:y][4:hullRot][4:turretRot][1:health]` × count |
| `0x16` | WAITING_FOR_PLAYERS | Lobby status | `[1:playerCount]` |
| `0x17` | GAME_START | Match begins, initial positions | `[4:p1Id][4:p1X][4:p1Y][4:p1HullRot][4:p1TurretRot][1:nameLen][N:name]` + same for p2 |
| `0x18` | BULLET_FIRED | Bullet spawned by server | `[4:bulletId][4:playerId][4:x][4:y][4:rotation][4:vx][4:vy]` |
| `0x19` | PLAYER_HIT | Player took damage | `[4:playerId][1:newHealth]` |
| `0x20` | PLAYER_DIED | Player health reached 0 | `[4:playerId]` |
| `0x21` | GAME_OVER | Match ended, final stats | `[4:winnerId]` + `[4:p1Id][1:kills][1:deaths][1:nameLen][N:name]` + same for p2 |
| `0x22` | BULLET_DESTROYED | Bullet removed (hit/expired) | `[4:bulletId]` |
| `0x23` | PLAYER_LEFT | Player disconnected | `[4:playerId]` |
| `0x30` | WALLS_INFO | Map walls configuration | `[4:count][4:mapWidth][4:mapHeight]` + `[4:x][4:y][4:w][4:h]` × count |
| `0x31` | BULLETS_STATE | All active bullets (30 Hz) | `[4:count]` + `[4:id][4:playerId][4:x][4:y][4:rotation][4:vx][4:vy]` × count |

### Data Types

| Type | Bytes | Description |
|------|-------|-------------|
| `Uint8` | 1 | Message type, health, counts |
| `Uint32` | 4 | Player IDs, bullet IDs, counts |
| `Float32` | 4 | Positions (x, y), rotations, velocities |
| `String` | Variable | Player names (length-prefixed) |

### Communication Flow

#### 1. Connection & Lobby
```
Client                              Server
  |                                   |
  |------- JOIN (name)  ------------->|
  |<----- JOIN_SUCCESS (id)  ---------|
  |<--- WAITING_FOR_PLAYERS (1/2)  ---|
  |                                   |
  [Another player joins]              |
  |<--- WAITING_FOR_PLAYERS (2/2) ---|
  |<------- WALLS_INFO --------------|
  |<------- GAME_START --------------|
```

#### 2. Game Loop (30 Hz)
```
Client                              Server
  |                                   |
  |--- PLAYER_INPUT (pos/rot)  ------>|
  |                                   | [Server validates]
  |                                   | [Updates game state]
  |<------ GAME_STATE (all)  ---------|
  |<----- BULLETS_STATE (all) --------|
  |                                   |
  |---- FIRE_BULLET (request)  ------>|
  |                                   | [Server creates bullet]
  |<----- BULLET_FIRED (new) ---------|
  |                                   | [Server checks collisions]
  |<----- PLAYER_HIT (damage) --------|
  |<----- BULLET_DESTROYED -----------|
```

#### 3. Game End
```
Client                              Server
  |                                   |
  |                                   | [Player health = 0]
  |<------ PLAYER_DIED  --------------|
  |<------ GAME_OVER (stats) ---------|
  |                                   |
  |--- READY_FOR_REMATCH  ----------->| [Optional]
```

### Server Architecture

#### Game Rooms
- **Matchmaking**: 2 players per room from lobby queue
- **Isolated state**: Each room has independent game state
- **Authoritative server**: All physics and collision on server

#### Tick Rate & Synchronization
- **30 Hz game loop**: Server updates at 30 ticks/second
- **State broadcast**: `GAME_STATE` and `BULLETS_STATE` sent every tick
- **Client prediction**: Client moves tank locally, server validates
- **Server reconciliation**: Client position overridden by server if needed

#### Collision Detection
- **Tank hitbox**: 80×50 world units (rotated rectangle)
- **Point-in-rotated-rect**: Bullet collision uses transformation matrix
- **Wall collision**: AABB (Axis-Aligned Bounding Box) with correction
- **Bullet bouncing**: Velocity inversion on wall normal

#### Security & Validation
- **Server authority**: All game logic runs on server
- **No client trust**: Client input is validated
- **Anti-cheat**: Position updates checked for validity
- **Grace period**: 500ms protection from own bullets

## Project Structure

```
combat/
├── server/
│   ├── server.js          # WebSocket game server (main)
│   └── GameRoom.js        # Game room logic (state, physics)
├── src/
│   ├── main.js            # Game client entry point
│   ├── Tank.js            # Tank entity (movement, collision)
│   ├── Bullet.js          # Bullet entity (visual only)
│   ├── Wall.js            # Wall entity (rendering)
│   └── NetworkManager.js  # Binary protocol handler
├── public/
│   ├── menu.html          # Main menu (connection setup)
│   ├── game.html          # Game page (Pixi.js canvas)
│   └── assets/            # Tank sprites (hull.svg, turret.svg)
├── package.json           # Dependencies and scripts
└── vite.config.js         # Vite configuration
```

### Key Files

#### `server/server.js`
- WebSocket server on port **8090**
- Binds to `0.0.0.0` for LAN access
- Handles connection/disconnection
- Matchmaking (2-player rooms)
- Game loop at 30 Hz
- Binary message parsing/creation
- Collision detection (bullets vs tanks/walls)

#### `server/GameRoom.js`
- Game state per room
- Player positions, health, stats
- Bullet management
- Hit detection logic
- Win/lose conditions

#### `src/NetworkManager.js`
- Binary protocol encoder/decoder
- WebSocket message handler
- Callbacks for game events
- Float32/Uint32 read/write helpers

#### `src/main.js`
- Pixi.js application setup
- Game loop (client-side)
- UI rendering (health, lobby, game over)
- Tank/bullet rendering
- Input → network message conversion
- Auto-detect server IP from URL

#### `src/Tank.js`
- Tank movement (WASD)
- Turret rotation (Arrow keys)
- Collision detection with walls
- Custom hitbox (80×50)
- Bullet firing request

#### `public/menu.html`
- Player name input
- Server URL input (auto-detected)
- Connection test before game
- Navigation to game page

## Development

### Server Configuration
- **Port**: 8090 (WebSocket)
- **Host**: `0.0.0.0` (accepts external connections)
- **Tick Rate**: 30 Hz (updates/second)
- **Protocol**: Binary over WebSocket (TCP)

### Client Configuration
- **Port**: 5173 (Vite dev server, auto-increments if busy)
- **Renderer**: Pixi.js v6+
- **Canvas size**: 1800×800 (fixed map)
- **Tank scale**: 0.5× (visual, hitbox in world units)

### Game Constants
- **Tank hitbox**: 80×50 world units (rotated)
- **Bullet lifetime**: 5000 ms
- **Self-hit grace period**: 500 ms
- **Player health**: 3 lives
- **Bullet speed**: 60 units/tick × deltaTime
- **Map size**: 1800×800 pixels

### Development Commands
```bash
# Install dependencies
npm install

# Run server + client together
npm run dev:all

# Run server only
npm run server

# Run client only (no --host)
npm run dev

# Run client with network access
npm run dev -- --host
```

### Network Testing
```bash
# Check if port is open
netstat -tuln | grep 8090

# Test WebSocket connection
wscat -c ws://localhost:8090

# Check firewall status (Linux)
sudo ufw status
```

## Troubleshooting

- **Cannot connect to server**: Make sure the server is running (`npm run server`)
- **Port already in use**: Change the port in `server/server.js`
- **Firewall blocking**: Allow ports 8080 and 5173 through your firewall
- **Network play not working**: Ensure all devices are on the same network and firewall allows incoming connections

## Technical Details

### Binary Protocol Advantages
- **Compact**: 30-50% smaller than JSON
- **Fast parsing**: No string parsing overhead
- **Type safety**: Fixed data types prevent errors
- **Network efficiency**: Less bandwidth usage

### Game Architecture

#### Client-Side
- **Rendering**: Pixi.js for 2D graphics
- **Input handling**: Keyboard events → network messages
- **Optimistic updates**: Local tank moves immediately
- **Server reconciliation**: Position corrected if needed
- **Visual only bullets**: Bullets rendered from server state

#### Server-Side
- **Authoritative**: All game logic on server
- **Room-based**: Isolated 1v1 matches
- **Deterministic**: Same input → same output
- **Collision detection**: Point-in-rotated-rect algorithm
- **State broadcast**: 30 Hz to all clients

### Performance Considerations
- **Binary protocol**: ~100 bytes/message vs ~300 for JSON
- **State batching**: One message with all players/bullets
- **Delta compression**: Could be added (send only changes)
- **Interpolation**: Could smooth movement between ticks
- **Prediction**: Client predicts movement, server validates

### Security Considerations
- **No client trust**: Server validates all input
- **Position validation**: Check for teleporting/speed hacks
- **Rate limiting**: Could add to prevent spam
- **Hitbox matching**: Server and client use same collision
- **Grace period**: Prevents self-damage exploits

## Future Enhancements


## Credits

Developed by **Ivan Cameo** and **Unai Yoldi** for the Advanced Telematic Services course at UPNA.

### Technologies Used
- [Pixi.js](https://pixijs.com/) - 2D WebGL renderer
- [ws](https://github.com/websockets/ws) - WebSocket library for Node.js
- [Vite](https://vitejs.dev/) - Frontend build tool
- [Node.js](https://nodejs.org/) - Server runtime

## License

This project is for educational purposes as part of the STA course at UPNA.
