const axios = require("axios");
const readline = require("readline");
const chalk = require("chalk");
const boxen = require("boxen").default;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const cache = {};

const catalogReplicas = [
  "http://catalog-service-1:3001",
  "http://catalog-service-2:3002",
];
const orderReplicas = [
  "http://order-service-1:3003",
  "http://order-service-2:3004",
];

let catalogIndex = 0;
let orderIndex = 0;

function getNextCatalogReplica() {
  catalogIndex = (catalogIndex + 1) % catalogReplicas.length;
  console.log(catalogReplicas[catalogIndex]);
  return catalogReplicas[catalogIndex];
}

function getNextOrderReplica() {
  orderIndex = (orderIndex + 1) % orderReplicas.length;
  console.log(orderReplicas[orderIndex]);
  return orderReplicas[orderIndex];
}


const catalogServer = getNextCatalogReplica();

// Try all catalog replicas
async function tryCatalogRequest(path) {
  for (let server of catalogReplicas) {
    try {
      const response = await axios.get(`${server}${path}`);
      return { data: response.data, server };
    } catch (err) {
      if (err.response && err.response.status === 404) continue;
      throw err;
    }
  }
  throw { message: "Book or topic not found on any catalog server" };
}

// Cache helpers
function getFromCache(key) {
  return cache[key] ? cache[key].data : null;
}

function setCache(key, data) {
  cache[key] = { data };
}

function invalidateCache(key) {
  if (cache[key]) delete cache[key];
  console.log(chalk.yellowBright(`Cache cleared successfully for "${key}"`));

}

// Welcome message
console.log(
  boxen(
    chalk.cyan.bold("Welcome to BAZAR.COM") +
      "\n" +
      chalk.greenBright("Your gateway to the world of books!"),
    { padding: 1, margin: 1, borderStyle: "round", borderColor: "magenta" }
  )
);

// Menu
function showMenu() {
  console.log(chalk.yellow.bold("\nWhat would you like to do?"));
  console.log(chalk.cyan("1.") + " Search for books by topic");
  console.log(chalk.cyan("2.") + " Get info about a book");
  console.log(chalk.cyan("3.") + " Purchase a book");
  console.log(chalk.cyan("4.") + " Exit");
  rl.question(chalk.magenta("\nChoose an option (1-4): "), handleUserInput);
}

function handleUserInput(option) {
  switch (option) {
    case "1":
      rl.question(chalk.yellow("Enter the topic: "), searchBooks);
      break;
    case "2":
      rl.question(chalk.yellow("Enter the item number of the book: "), getBookInfo);
      break;
    case "3":
      rl.question(chalk.yellow("Enter the item number to purchase: "), purchaseBook);
      break;
    case "4":
      console.log(chalk.greenBright("\nThank you for visiting Bazar.com!"));
      rl.close();
      break;
    default:
      console.log(chalk.redBright("Invalid option. Try again."));
      showMenu();
  }
}

// Search books
async function searchBooks(topic) {
  const cacheKey = `search:${topic}`;
  const cachedData = getFromCache(cacheKey);

  if (cachedData) {
    console.log(chalk.greenBright("\nBooks found (from cache):"));
    console.table(cachedData);
    return showMenu();
  }

  try {
    const { data, server } = await tryCatalogRequest(`/search/${topic}`);
    console.log(chalk.greenBright(`\nBooks found from ${server}:`));
    console.table(data);
    setCache(cacheKey, data);
  } catch (err) {
    console.log(chalk.redBright("Error:"), err.message || err);
  }
  showMenu();
}

// Get book info
async function getBookInfo(itemNumber) {
  const cacheKey = `info:${itemNumber}`;
  const cachedData = getFromCache(cacheKey);

  if (cachedData) {
    console.log(chalk.greenBright("\nBook info (from cache):"));
    console.table([cachedData]);
    return showMenu();
  }

  try {
    const { data, server } = await tryCatalogRequest(`/info/${itemNumber}`);
    console.log(chalk.cyanBright(`\nBook info from ${server}:`));
    console.table([data]);
    setCache(cacheKey, data);
  } catch (err) {
    console.log(chalk.redBright("Error:"), err.message || err);
  }
  showMenu();
}

// Purchase book
async function purchaseBook(itemNumber) {
  const orderServer = getNextOrderReplica();
  try {
    const response = await axios.post(`${orderServer}/purchase/${itemNumber}`);
    console.log(chalk.green.bold(`\n${response.data.message}`));

    // invalidate caches
    invalidateCache(`info:${itemNumber}`);

    try {
      const { data } = await tryCatalogRequest(`/info/${itemNumber}`);
      invalidateCache(`search:${data.topic}`);
    } catch {}
  } catch (err) {
    console.log(chalk.redBright("Error:"), err.response ? err.response.data : err.message);
  }
  showMenu();
}

showMenu();
