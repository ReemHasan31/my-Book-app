// client.js
const axios = require("axios");
const readline = require("readline");
const chalk = require("chalk");
const boxen = require("boxen");

// إعداد القراءة من المستخدم
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// الكاش المحلي (Cache)
const cache = {};

// السيرفرات المكررة (Replicas)
const catalogReplicas = [
  "http://catalog-service-1:3001",
  "http://catalog-service-2:3002",
];
const orderReplicas = [
  "http://order-service-1:3003",
  "http://order-service-2:3004",
];

let catalogReplicaIndex = 0;
let orderReplicaIndex = 0;

// اختيار السيرفر التالي (Load Balancing)
function getNextCatalogReplica() {
  catalogReplicaIndex = (catalogReplicaIndex + 1) % catalogReplicas.length;
  console.log(chalk.blueBright(`📡 Using Catalog Server: ${catalogReplicas[catalogReplicaIndex]}`));
  return catalogReplicas[catalogReplicaIndex];
}

function getNextOrderReplica() {
  orderReplicaIndex = (orderReplicaIndex + 1) % orderReplicas.length;
  console.log(chalk.blueBright(`📡 Using Order Server: ${orderReplicas[orderReplicaIndex]}`));
  return orderReplicas[orderReplicaIndex];
}

// شاشة الترحيب 🎉
console.log(
  boxen(
    chalk.cyan.bold("📚 Welcome to BAZAR.COM 📚") +
      "\n" +
      chalk.greenBright("Your gateway to the world of books! "),
    {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "magenta",
      backgroundColor: "#1e1e1e",
    }
  )
);

// القائمة الرئيسية
function showMenu() {
  console.log(chalk.yellow.bold("\n📖 What would you like to do?"));
  console.log(chalk.cyan("1.") + " 🔍 Search for books by topic");
  console.log(chalk.cyan("2.") + " ℹ️  Get info about a book");
  console.log(chalk.cyan("3.") + " 💳 Purchase a book");
  console.log(chalk.cyan("4.") + " 🚪 Exit");
  rl.question(chalk.magenta("\n Choose an option (1-4): "), handleUserInput);
}

// التعامل مع اختيار المستخدم
function handleUserInput(option) {
  switch (option) {
    case "1":
      rl.question(chalk.yellow("💡 Enter the topic: "), searchBooks);
      break;
    case "2":
      rl.question(chalk.yellow("📘 Enter the item number of the book: "), getBookInfo);
      break;
    case "3":
      rl.question(chalk.yellow("💰 Enter the item number to purchase: "), purchaseBook);
      break;
    case "4":
      console.log(chalk.greenBright("\n Thank you for visiting Bazar.com! Happy reading! 📖"));
      rl.close();
      break;
    default:
      console.log(chalk.redBright("❌ Invalid option. Try again."));
      showMenu();
  }
}

// إدارة الكاش
function getFromCache(key) {
  const entry = cache[key];
  return entry ? entry.data : null;
}

function setCache(key, data) {
  cache[key] = { data };
}

function invalidateCache(key) {
  if (cache[key]) {
    delete cache[key];
    console.log(chalk.gray(`🧹 Cache invalidated for: ${key}`));
  }
}

// البحث عن الكتب
function searchBooks(topic) {
  const cacheKey = `search:${topic}`;
  const cachedData = getFromCache(cacheKey);

  if (cachedData) {
    console.log(chalk.greenBright("\n📦 Books found (from cache):"));
    console.table(cachedData);
    return showMenu();
  }

  const catalogServer = getNextCatalogReplica();

  axios
    .get(`${catalogServer}/search/${topic}`)
    .then((response) => {
      console.log(chalk.greenBright("\n✨ Books found:"));
      console.table(response.data);
      setCache(cacheKey, response.data);
      showMenu();
    })
    .catch((err) => {
      console.log(chalk.redBright("❌ Error:"), err.response ? err.response.data : err.message);
      showMenu();
    });
}

// عرض معلومات كتاب
function getBookInfo(itemNumber) {
  const cacheKey = `info:${itemNumber}`;
  const cachedData = getFromCache(cacheKey);

  if (cachedData) {
    console.log(chalk.greenBright("\n📘 Book info (from cache):"));
    console.table([cachedData]);
    return showMenu();
  }

  const catalogServer = getNextCatalogReplica();

  axios
    .get(`${catalogServer}/info/${itemNumber}`)
    .then((response) => {
      console.log(chalk.cyanBright("\n📖 Book info:"));
      console.table([response.data]);
      setCache(cacheKey, response.data);
      showMenu();
    })
    .catch((err) => {
      console.log(chalk.redBright("❌ Error:"), err.response ? err.response.data : err.message);
      showMenu();
    });
}

// شراء كتاب
function purchaseBook(itemNumber) {
  const orderServer = getNextOrderReplica();

  axios
    .post(`${orderServer}/purchase/${itemNumber}`)
    .then((response) => {
      console.log(chalk.green.bold(`\n🎉 ${response.data.message}`));
      const cacheKey = `info:${itemNumber}`;
      invalidateCache(cacheKey);

      const catalogServer = getNextCatalogReplica();
      axios.get(`${catalogServer}/info/${itemNumber}`).then((response) => {
        const topic = response.data.topic;
        const searchCacheKey = `search:${topic}`;
        invalidateCache(searchCacheKey);
      });
      showMenu();
    })
    .catch((err) => {
      console.log(chalk.redBright("❌ Error:"), err.response ? err.response.data : err.message);
      showMenu();
    });
}

// تشغيل البرنامج
showMenu();
