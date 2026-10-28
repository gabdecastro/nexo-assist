import app from './app.js';
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => {
  const address = server.address();
  console.log(`Nexo Assist API em http://localhost:${typeof address === 'object' && address ? address.port : port}`);
});
