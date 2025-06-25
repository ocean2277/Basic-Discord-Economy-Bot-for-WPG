const { Client, Collection, GatewayIntentBits, EmbedBuilder, WebhookClient, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config.json');
const moment = require('moment-timezone');
const { startVoiceChannelUpdate } = require('./utils/updateVoiceChannel');

const logStream = fs.createWriteStream('log.txt', { flags: 'a' });
console.log = (...args) => {
  logStream.write(`${new Date().toISOString()} ${args.join(' ')}\n`);
  process.stdout.write(`${args.join(' ')}\n`);
};
console.error = (...args) => {
  logStream.write(`${new Date().toISOString()} ERROR: ${args.join(' ')}\n`);
  process.stderr.write(`${args.join(' ')}\n`);
};

const auditWebhook = new WebhookClient({
  id: config.webhookId,
  token: config.webhookToken,
});

const BALANCE_THRESHOLD = 1000000;
const INFLATION_COEFFICIENT = 0.5;
const INCOME_INTERVAL = 4 * 60 * 60 * 1000;
const DELIVERY_DAYS = 5;
const CHECK_DELIVERY_INTERVAL = 30 * 60 * 1000;
const CHECK_SPY_INTERVAL = 60 * 1000;
const CHECK_INVESTMENT_INTERVAL = 60 * 60 * 1000;
const CHECK_SATELLITE_INTERVAL = 60 * 60 * 1000;
const CHECK_PRODUCTION_INTERVAL = 5 * 60 * 1000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
});

const db = new sqlite3.Database('./economy.db', (err) => {
  if (err) return console.error('Database connection error:', err);
  console.log('Подключено economy.db');
});

client.db = db;

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    voiceTime INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shop (
    itemName TEXT PRIMARY KEY,
    price INTEGER,
    description TEXT,
    productionTime TEXT,
    isTransport INTEGER DEFAULT 0,
    requiredRoleId TEXT,
    isSpy INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shop2 (
    itemName TEXT PRIMARY KEY,
    price INTEGER,
    stock INTEGER,
    description TEXT,
    sellCommission REAL DEFAULT 0,
    isTransport INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    userId TEXT,
    itemName TEXT,
    quantity INTEGER,
    shopType INTEGER,
    PRIMARY KEY (userId, itemName)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS balance_audit (
    userId TEXT,
    amount INTEGER,
    reason TEXT,
    changeTime INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS role_income (
    userId TEXT,
    roleId TEXT,
    lastClaim INTEGER,
    PRIMARY KEY (userId, roleId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS buy_bans (
    userId TEXT PRIMARY KEY,
    isBanned INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pending_trades (
    tradeId INTEGER PRIMARY KEY AUTOINCREMENT,
    sellerId TEXT,
    buyerId TEXT,
    itemName TEXT,
    quantity INTEGER,
    price INTEGER,
    shopType INTEGER,
    startDate INTEGER,
    deliveryDate INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS spies (
    spyId INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    name TEXT,
    patronymic TEXT,
    age INTEGER,
    experience TEXT DEFAULT 'novice',
    FOREIGN KEY (userId) REFERENCES users(userId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS spy_trainings (
    trainingId INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    spyId INTEGER,
    startDate INTEGER,
    durationDays INTEGER,
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (spyId) REFERENCES spies(spyId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS spy_missions (
    missionId INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    spyId INTEGER,
    type TEXT,
    targetCountry TEXT,
    preparationLevel INTEGER,
    startDate INTEGER,
    durationDays INTEGER,
    channelId TEXT,
    method TEXT,
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (spyId) REFERENCES spies(spyId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS investments (
    investmentId TEXT PRIMARY KEY,
    userId TEXT,
    type TEXT,
    target TEXT,
    purpose TEXT,
    amount INTEGER,
    durationDays INTEGER,
    startDate INTEGER,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (userId) REFERENCES users(userId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS satellites (
    satelliteId TEXT PRIMARY KEY,
    userId TEXT,
    type TEXT,
    mass INTEGER,
    techLevel TEXT,
    cost INTEGER,
    startDate INTEGER,
    durationDays INTEGER,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (userId) REFERENCES users(userId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS production_queue (
    userId TEXT,
    itemName TEXT,
    quantity INTEGER,
    progressLevel INTEGER,
    startDate INTEGER,
    endDate INTEGER,
    PRIMARY KEY (userId, itemName)
  )`, (err) => {
    if (err) console.error('Error creating production_queue table:', err);
    else console.log('Таблица production_queue запарсирована');
  });
  db.run(`CREATE TABLE IF NOT EXISTS waiting_queue (
    userId TEXT,
    itemName TEXT,
    quantity INTEGER,
    progressLevel INTEGER,
    orderTime INTEGER,
    PRIMARY KEY (userId, itemName)
  )`, (err) => {
    if (err) console.error('Error creating waiting_queue table:', err);
    else console.log('Таблица waiting_queue запарсирована');
  });

  db.get('SELECT value FROM settings WHERE key = ?', ['baseYear'], (err, row) => {
    if (err) console.error('Error checking baseYear:', err);
    if (!row) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['baseYear', '1930'], (err) => {
        if (err) console.error('Error initializing baseYear:', err);
        else console.log('Запущено 1930');
      });
    }
  });

  db.all("PRAGMA table_info(inventory)", (err, rows) => {
    if (err) return console.error('Error checking inventory table:', err);
    if (!rows.some(row => row.name === 'shopType')) {
      db.run("ALTER TABLE inventory ADD COLUMN shopType INTEGER DEFAULT 1", (err) => {
        if (!err) {
          db.run(`UPDATE inventory SET shopType = 2 WHERE itemName IN (SELECT itemName FROM shop2)`);
        }
      });
    }
  });

  db.all("PRAGMA table_info(balance_audit)", (err, rows) => {
    if (err) return console.error('Error checking balance_audit table:', err);
    if (!rows.some(row => row.name === 'amount')) {
      db.run("ALTER TABLE balance_audit ADD COLUMN amount INTEGER");
    }
  });

  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) return console.error('Error checking users table:', err);
    if (!rows.some(row => row.name === 'voiceTime')) {
      db.run("ALTER TABLE users ADD COLUMN voiceTime INTEGER DEFAULT 0");
    }
  });

  db.all("PRAGMA table_info(shop2)", (err, rows) => {
    if (err) return console.error('Error checking shop2 table:', err);
    if (!rows.some(row => row.name === 'sellCommission')) {
      db.run("ALTER TABLE shop2 ADD COLUMN sellCommission REAL DEFAULT 0");
    }
    if (!rows.some(row => row.name === 'isTransport')) {
      db.run("ALTER TABLE shop2 ADD COLUMN isTransport INTEGER DEFAULT 0");
    }
  });

  db.all("PRAGMA table_info(shop)", (err, rows) => {
    if (err) return console.error('Error checking shop table:', err);
    if (!rows.some(row => row.name === 'isTransport')) {
      db.run("ALTER TABLE shop ADD COLUMN isTransport INTEGER DEFAULT 0");
    }
    if (!rows.some(row => row.name === 'requiredRoleId')) {
      db.run("ALTER TABLE shop ADD COLUMN requiredRoleId TEXT", (err) => {
        if (err) console.error('Error adding requiredRoleId to shop table:', err);
        else console.log('Добавлено requiredRoleId колону');
      });
    }
    if (!rows.some(row => row.name === 'isSpy')) {
      db.run("ALTER TABLE shop ADD COLUMN isSpy INTEGER DEFAULT 0", (err) => {
        if (err) console.error('Error adding isSpy to shop table:', err);
        else console.log('Добавлено isSpy');
      });
    }
  });
});

const query = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

function getGameDate(timestamp) {
  const now = moment(timestamp).tz('Europe/Kiev');
  const hours = now.hours();
  const minutes = now.minutes();
  const totalMinutes = hours * 60 + minutes;
  return Math.floor(totalMinutes / 8);
}

async function checkPendingTrades() {
  console.log('Проверка трейдов...');
  const currentTime = Date.now();
  const currentGameDays = getGameDate(currentTime);

  db.all(`SELECT * FROM pending_trades`, async (err, trades) => {
    if (err) return console.error('Error checking pending trades:', err);
    if (!trades.length) return;

    for (const trade of trades) {
      const { tradeId, sellerId, buyerId, itemName, quantity, shopType, startDate } = trade;
      const startGameDays = getGameDate(startDate);
      const deliveryGameDays = startGameDays + DELIVERY_DAYS;

      if (currentGameDays >= deliveryGameDays) {
        const guild = client.guilds.cache.first();
        const buyer = await guild.members.fetch(buyerId).catch(() => null);
        if (!buyer) {
          console.warn(`Buyer ${buyerId} not found for trade ${tradeId}`);
          continue;
        }

        db.run(
          `INSERT OR REPLACE INTO inventory (userId, itemName, quantity, shopType) VALUES (?, ?, COALESCE((SELECT quantity FROM inventory WHERE userId = ? AND itemName = ? AND shopType = ?) + ?, ?), ?)`,
          [buyerId, itemName, buyerId, itemName, shopType, quantity, quantity, shopType],
          (err) => {
            if (err) {
              console.error('Inventory update error for trade:', err);
              return;
            }

            db.run(`DELETE FROM pending_trades WHERE tradeId = ?`, [tradeId], (err) => {
              if (err) {
                console.error('Trade deletion error:', err);
                return;
              }

              buyer.send({
                embeds: [{
                  color: 0x9b909e,
                  title: 'Доставка предмета',
                  description: `Вы получили **${itemName}** (${quantity} шт.) от <@${sellerId}>`,
                  footer: { text: buyer.user.username },
                  timestamp: new Date().toISOString(),
                }],
              }).catch(console.error);

              auditWebhook.send({
                embeds: [{
                  color: 0x9b909e,
                  title: 'Завершение сделки',
                  fields: [
                    { name: 'Продавец', value: `<@${sellerId}>`, inline: true },
                    { name: 'Покупатель', value: `<@${buyerId}>`, inline: true },
                    { name: 'Предмет', value: itemName, inline: true },
                    { name: 'Количество', value: `${quantity} шт.`, inline: true },
                    { name: 'Магазин', value: shopType === 1 ? 'Первый' : 'Второй', inline: true },
                  ],
                  timestamp: new Date().toISOString(),
                }],
              }).catch(console.error);
            });
          }
        );
      }
    }
  });
}

async function checkProductionQueue() {
  console.log('Проверка...');
  const currentTime = Date.now();
  const currentGameDays = getGameDate(currentTime);

  db.all(`SELECT * FROM production_queue WHERE endDate <= ?`, [currentGameDays], async (err, rows) => {
    if (err) {
      console.error('Error checking production_queue for completion:', err);
      return;
    }
    if (!rows || rows.length === 0) {
      console.log('Нет заверешнных');
      return;
    }

    for (const row of rows) {
      const { userId, itemName, quantity, progressLevel } = row;

      db.get('SELECT itemName FROM shop WHERE LOWER(itemName) = ?', [itemName.toLowerCase()], async (err, shopItem) => {
        if (err) {
          console.error('Error checking shop for item:', err);
          return;
        }

        const shopType = shopItem ? 1 : 2;

        db.run(
          `INSERT OR REPLACE INTO inventory (userId, itemName, quantity, shopType) VALUES (?, ?, COALESCE((SELECT quantity FROM inventory WHERE userId = ? AND itemName = ? AND shopType = ?) + ?, ?), ?)`,
          [userId, itemName, userId, itemName, shopType, quantity, quantity, shopType],
          (err) => {
            if (err) {
              console.error('Error adding to inventory from production_queue:', err);
              return;
            }

            db.run('DELETE FROM production_queue WHERE userId = ? AND itemName = ?', [userId, itemName], (err) => {
              if (err) {
                console.error('Error deleting from production_queue:', err);
                return;
              }

              const guild = client.guilds.cache.first();
              guild.members.fetch(userId).then(member => {
                member.send({
                  embeds: [{
                    color: 0x9b909e,
                    title: 'Завершение производства',
                    description: `Производство завершено!\nПредмет: **${itemName}** (${quantity} шт.)\nДобавлено в инвентарь (Магазин: ${shopType === 1 ? 'Первый' : 'Второй'})`,
                    footer: { text: member.user.username },
                    timestamp: new Date().toISOString(),
                  }],
                }).catch(err => console.error(`Failed to notify user ${userId}:`, err));
              }).catch(err => console.error(`Failed to fetch member ${userId}:`, err));

              auditWebhook.send({
                embeds: [{
                  color: 0x9b909e,
                  title: 'Завершение производства',
                  fields: [
                    { name: 'Пользователь', value: `<@${userId}>`, inline: true },
                    { name: 'Предмет', value: itemName, inline: true },
                    { name: 'Количество', value: `${quantity} шт.`, inline: true },
                    { name: 'Уровень прогресса', value: `${progressLevel}`, inline: true },
                    { name: 'Магазин', value: shopType === 1 ? 'Первый' : 'Второй', inline: true },
                  ],
                  timestamp: new Date().toISOString(),
                }],
              }).catch(console.error);

              console.log(`Компилировано: ${itemName} x${quantity} для юзера ${userId}, добавлено в инвентарь (shopType: ${shopType})`);

              db.get('SELECT SUM(quantity) as total FROM production_queue WHERE userId = ?', [userId], (err, slotRow) => {
                if (err) {
                  console.error('Error checking slots:', err);
                  return;
                }
                const usedSlots = slotRow.total || 0;

                let maxSlots = 20; 
                const member = guild.members.cache.get(userId);
                if (member) {
                  let progressLevel = 0;
                  if (config.progressRoles && Array.isArray(config.progressRoles)) {
                    for (let i = 0; i < config.progressRoles.length; i++) {
                      if (member.roles.cache.has(config.progressRoles[i])) {
                        progressLevel = Math.max(progressLevel, i + 1);
                      }
                    }
                  }
                  const slotLimits = [20, 40, 60, 80, 100, 120];
                  maxSlots = slotLimits[progressLevel - 1] || 20;
                }
                const availableSlots = maxSlots - usedSlots;

                if (availableSlots > 0) {
                  processWaitingQueue(userId, db, progressLevel, availableSlots);
                }
              });
            });
          }
        );
      });
    }
  });
}

async function checkSpyMissions() {
  console.log('Проверка спай миссий...');
  const currentTime = Date.now();
  const currentGameDays = getGameDate(currentTime);

  db.all(`SELECT * FROM spy_missions`, async (err, missions) => {
    if (err) return console.error('Error checking spy missions:', err);
    if (!missions.length) return;

    for (const mission of missions) {
      const { missionId, userId, spyId, type, targetCountry, startDate, durationDays, channelId } = mission;
      const startGameDays = getGameDate(startDate);
      const endGameDays = startGameDays + durationDays;

      if (currentGameDays >= endGameDays) {
        const guild = client.guilds.cache.get(config.guildId);
        const user = await guild.members.fetch(userId).catch(() => null);
        if (!user) {
          console.warn(`User ${userId} not found for mission ${missionId}`);
          continue;
        }

        db.get('SELECT name, experience FROM spies WHERE spyId = ?', [spyId], async (err, spy) => {
          if (err) return console.error('Error fetching spy:', err);

          const category = await guild.channels.fetch(config.spyCategoryId).catch(() => null);
          if (!category) {
            console.error(`Spy category ${config.spyCategoryId} not found`);
            return;
          }

          const channel = await guild.channels.create({
            name: `mission-${missionId}-${type}`,
            type: 0,
            parent: category.id,
            permissionOverwrites: [
              { id: guild.id, deny: ['VIEW_CHANNEL'] },
              { id: userId, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] },
              { id: client.user.id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] },
            ],
          }).catch((err) => {
            console.error('Error creating mission channel:', err);
            return null;
          });

          if (channel) {
            await channel.send({
              embeds: [{
                color: 0x9b909e,
                title: `Завершение ${type === 'counterintelligence' ? 'Контрразведки' : 'Разведки'}`,
                description: `Миссия завершена!\nШпион: ${spy.name} (${spy.experience})\nЦель: ${targetCountry || 'N/A'}`,
                footer: { text: user.user.username },
                timestamp: new Date().toISOString(),
              }],
            });

            db.run('UPDATE spy_missions SET channelId = ? WHERE missionId = ?', [channel.id, missionId]);
          }

          db.run('DELETE FROM spy_missions WHERE missionId = ?', [missionId], (err) => {
            if (err) console.error('Error deleting mission:', err);
          });

          user.send({
            embeds: [{
              color: 0x9b909e,
              title: `Завершение ${type === 'counterintelligence' ? 'Контрразведки' : 'Разведки'}`,
              description: `Ваша миссия завершена!\nШпион: ${spy.name} (${spy.experience})\nЦель: ${targetCountry || 'N/A'}`,
              footer: { text: user.user.username },
              timestamp: new Date().toISOString(),
            }],
          }).catch(console.error);

          if (type === 'intelligence' && spy.experience === 'novice') {
            db.run('UPDATE spies SET experience = ? WHERE spyId = ?', ['experienced', spyId]);
          }
        });
      }
    }
  });
}

async function processRoleIncome() {
  console.log('Доход от ролей...');
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return console.error('No guild found');

    const currentTimeMillis = Date.now();
    const members = await guild.members.fetch();

    for (const member of members.values()) {
      const userId = member.id;
      const eligibleRoles = config.incomeRoles.filter(role => member.roles.cache.has(role.roleId));
      if (eligibleRoles.length === 0) continue;

      const userRow = await query('SELECT balance FROM users WHERE userId = ?', [userId]);
      const balance = userRow ? userRow.balance : 0;

      let inflationFactor = 1;
      if (balance > BALANCE_THRESHOLD) {
        const excess = (balance - BALANCE_THRESHOLD) / BALANCE_THRESHOLD;
        inflationFactor = 1 / (1 + INFLATION_COEFFICIENT * excess);
      }

      let totalIncome = 0;
      let claimedRoles = [];

      for (const { roleId, amount } of eligibleRoles) {
        const row = await query('SELECT lastClaim FROM role_income WHERE userId = ? AND roleId = ?', [userId, roleId]);
        const lastClaim = row ? row.lastClaim : 0;

        if (currentTimeMillis - lastClaim >= INCOME_INTERVAL) {
          const roleIncome = Math.round(amount * inflationFactor);
          totalIncome += roleIncome;
          claimedRoles.push(`<@&${roleId}> ${amount} -> ${roleIncome} ${config.cur}`);

          db.run(
            'INSERT OR REPLACE INTO role_income (userId, roleId, lastClaim) VALUES (?, ?, ?)',
            [userId, roleId, currentTimeMillis],
          );
        }
      }

      if (totalIncome > 0) {
        await finalizeIncome(userId, totalIncome, claimedRoles, balance, inflationFactor, member);
      }
    }
  } catch (error) {
    console.error('Error in processRoleIncome:', error);
  }
}

async function finalizeIncome(userId, totalIncome, claimedRoles, balance, inflationFactor, member) {
  try {
    db.run(
      'INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) + ?, 0) + ?)',
      [userId, userId, totalIncome, totalIncome],
      (err) => {
        if (err) {
          console.error('Error updating user balance:', err);
          return;
        }

        db.run(
          'INSERT INTO balance_audit (userId, amount, reason, changeTime) VALUES (?, ?, ?, ?)',
          [userId, totalIncome, `Автоначисление: ${claimedRoles.join(', ')}`, Date.now()],
          (err) => {
            if (err) {
              console.error('Error inserting balance_audit:', err);
              return;
            }

            const embed = new EmbedBuilder()
              .setColor('#9B909E')
              .setTitle('Успешное автоначисление дохода!')
              .setDescription(`Вы получили доход:\n${claimedRoles.join('\n')}${inflationFactor < 1 ? `\n\n**Инфляция**: Доход уменьшен на ${((1 - inflationFactor) * 100).toFixed(2)}% из-за баланса ${balance} ${config.cur}` : ''}`)
              .setFooter({ text: member.user.username })
              .setTimestamp();

            member.send({ embeds: [embed] }).catch(() => {});

            const auditEmbed = {
              color: 0x9b909e,
              title: 'Автоначисление дохода',
              fields: [
                { name: 'Пользователь', value: `${member.user.tag} (${userId})`, inline: true },
                { name: 'Доход', value: claimedRoles.join('\n') || 'None', inline: true },
                { name: 'Сумма', value: `${totalIncome} ${config.cur}`, inline: true },
                { name: 'Инфляция', value: inflationFactor < 1 ? `${((1 - inflationFactor) * 100).toFixed(2)}%` : 'Отсутствует', inline: true },
              ],
              timestamp: new Date().toISOString(),
            };
            auditWebhook.send({ embeds: [auditEmbed] }).catch(console.error);
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in finalizeIncome:', error);
  }
}

function processWaitingQueue(userId, db, progressLevel, availableSlots) {
  db.all('SELECT itemName, quantity, orderTime, progressLevel FROM waiting_queue WHERE userId = ? ORDER BY orderTime ASC', [userId], (err, waitingItems) => {
    if (err) {
      console.error('Error fetching waiting queue:', err);
      return;
    }

    if (waitingItems.length === 0) {
      console.log('Очередь ожидания пуста для:', userId);
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      let remainingSlots = availableSlots;
      for (const item of waitingItems) {
        if (remainingSlots <= 0) break;

        const moveQuantity = Math.min(item.quantity, remainingSlots);
        const currentGameDay = getGameDate(Date.now());
        db.get('SELECT productionTime FROM shop WHERE LOWER(itemName) = ?', [item.itemName.toLowerCase()], (err, shopItem) => {
          if (err || !shopItem) {
            console.error('Error fetching production time:', err);
            return;
          }
          const productionTime = JSON.parse(shopItem.productionTime);
          const productionDays = productionTime[`progress${item.progressLevel}`] || productionTime[`progress${progressLevel}`];

          const endGameDay = currentGameDay + productionDays;

          db.run('INSERT OR REPLACE INTO production_queue (userId, itemName, quantity, startDate, endDate, progressLevel) VALUES (?, ?, ?, ?, ?, ?) ' +
                 'ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + excluded.quantity, startDate = excluded.startDate, endDate = excluded.endDate, progressLevel = excluded.progressLevel',
            [userId, item.itemName, moveQuantity, Date.now(), endGameDay, item.progressLevel], err => {
              if (err) {
                db.run('ROLLBACK', () => console.error('Error moving to production_queue:', err));
                return;
              }

              const newQuantity = item.quantity - moveQuantity;
              if (newQuantity > 0) {
                db.run('UPDATE waiting_queue SET quantity = ? WHERE userId = ? AND itemName = ?', [newQuantity, userId, item.itemName], err => {
                  if (err) {
                    db.run('ROLLBACK', () => console.error('Error updating waiting_queue:', err));
                    return;
                  }
                });
              } else {
                db.run('DELETE FROM waiting_queue WHERE userId = ? AND itemName = ?', [userId, item.itemName], err => {
                  if (err) {
                    db.run('ROLLBACK', () => console.error('Error deleting from waiting_queue:', err));
                    return;
                  }
                });
              }

              remainingSlots -= moveQuantity;
            });
        });
      }

      db.run('COMMIT', () => {
        console.log(`Процесс ${availableSlots - remainingSlots} айтем для ${userId}`);
      });
    });
  });
}

client.commands = new Collection();
client.slashCommands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('name' in command && 'execute' in command && !('data' in command)) {
    client.commands.set(command.name, command);
    console.log(`Загружено: ${command.name}`);
  } else if ('data' in command && 'execute' in command) {
    client.slashCommands.set(command.data.name, command);
    console.log(`Загружено слеш: ${command.data.name}`);
  } else {
    console.warn(`Command ${file} missing required properties`);
  }
}

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) {
    console.log(`Хз че такое: ${commandName} от ${message.author.id}`);
    return;
  }

  console.log(`Загружено команду: ${commandName} от ${message.author.id} в ${message.guild ? message.guild.id : 'DM'}`);

  try {
    await command.execute(message, args, db, auditWebhook, { BALANCE_THRESHOLD, INFLATION_COEFFICIENT, DELIVERY_DAYS });
  } catch (error) {
    console.error(`Error in command ${commandName}:`, error);
    message.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Ошибка',
        description: 'Произошла ошибка при выполнении команды.',
        timestamp: new Date().toISOString(),
      }],
      flags: ['Ephemeral'],
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  console.log(`Интеракция от: ${interaction.type} от  ${interaction.user.id} в ${interaction.guild ? interaction.guild.id : 'DM'}`);

  if (interaction.isCommand()) {
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) {
      console.log(`Unknown slash command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, db, auditWebhook);
    } catch (error) {
      console.error(`Error in slash command ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Произошла ошибка при выполнении команды.',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      }
    }
  }
});

client.once('ready', async () => {
  console.log(`Бот запущен ${client.user.tag} | Гильдии: ${client.guilds.cache.map(g => g.id).join(', ')}`);

  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  const commands = client.slashCommands.map(command => command.data.toJSON());

  try {
    console.log('Рефреш слеш (/) .');
    await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), { body: commands });
    console.log('Усппешно (/) .');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
  client.user.setPresence({
    activities: [{ name: 'WhiteDove', type: 'PLAYING' }],
    status: 'idle',
  });

  processRoleIncome();
  setInterval(processRoleIncome, INCOME_INTERVAL);
  checkPendingTrades();
  setInterval(checkPendingTrades, CHECK_DELIVERY_INTERVAL);
  checkSpyMissions();
  setInterval(checkSpyMissions, CHECK_SPY_INTERVAL);
  checkProductionQueue();
  setInterval(checkProductionQueue, CHECK_PRODUCTION_INTERVAL);
  require('./checkInvestments')(client);
  setInterval(() => require('./checkInvestments')(client), CHECK_INVESTMENT_INTERVAL);
  require('./checkSatellites')(client);
  setInterval(() => require('./checkSatellites')(client), CHECK_SATELLITE_INTERVAL);
  startVoiceChannelUpdate(client, config, db);
});

client.login(config.TOKEN);