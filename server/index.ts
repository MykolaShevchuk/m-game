import { defineServer, defineRoom } from 'colyseus';
import { GameRoom } from './rooms/GameRoom';

const PORT = Number(process.env.PORT) || 3001;

const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom),
  },
  express: (app) => {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('m-game Colyseus server\n');
    });
  },
});

void server.listen(PORT, '0.0.0.0', undefined, () => {
  console.log(`m-game Colyseus listening on http://0.0.0.0:${PORT} (LAN: http://<your-ip>:${PORT})`);
});
