import 'dotenv/config';
import app from './app';
import { autoCloseResolvedTickets } from './jobs/autoCloseTickets';

const PORT = process.env.PORT || 3000;

autoCloseResolvedTickets();
setInterval(autoCloseResolvedTickets, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`ITAM API running on port ${PORT}`);
});