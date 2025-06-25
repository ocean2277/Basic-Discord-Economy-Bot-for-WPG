const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const config = require('./config.json');

function getGameDate(timestamp) {
  const now = moment(timestamp).tz('Europe/Kiev');
  const hours = now.hours();
  const minutes = now.minutes();
  const totalMinutes = hours * 60 + minutes;
  return Math.floor(totalMinutes / 8);
}

module.exports = (client) => {
  console.log('Checking satellites...');
  const db = client.db; 
  const currentTime = Date.now();
  const currentGameDays = getGameDate(currentTime);

  db.all(`SELECT * FROM satellites WHERE status = 'pending'`, async (err, satellites) => {
    if (err) {
      console.error('Error checking satellites:', err);
      return;
    }
    if (!satellites.length) return;

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('Guild not found:', config.guildId);
      return;
    }

    const channel = await guild.channels.fetch(config.satelliteResultChannelId).catch(() => null);
    if (!channel) {
      console.error(`Satellite result channel ${config.satelliteResultChannelId} not found`);
      return;
    }

    for (const satellite of satellites) {
      const { satelliteId, userId, type, mass, techLevel, durationDays, startDate } = satellite;
      const startGameDays = getGameDate(startDate);
      const endGameDays = startGameDays + durationDays;

      if (currentGameDays >= endGameDays) {
        const failureChance = techLevel === 'III' ? 0.3 : techLevel === 'IV-V' ? 0.2 : 0.1;
        const detectionChance = mass > 2000 ? 0.4 : mass > 500 ? 0.2 : 0.05;
        const outcome = Math.random() < failureChance ? 'failed' : Math.random() < detectionChance ? 'detected' : 'active';

        db.run('UPDATE satellites SET status = ? WHERE satelliteId = ?', [outcome, satelliteId], (err) => {
          if (err) {
            console.error('Error updating satellite status:', err);
            return;
          }

          const user = guild.members.fetch(userId).catch(() => null);
          if (!user) {
            console.warn(`User ${userId} not found for satellite ${satelliteId}`);
            return;
          }

          const outcomeText = outcome === 'failed' ? 'Спутник вышел из строя' : outcome === 'detected' ? 'Спутник обнаружен' : 'Спутник успешно функционирует';
          channel.send({
            embeds: [{
              color: outcome === 'failed' ? 0xff0000 : outcome === 'detected' ? 0xffff00 : 0x00ff00,
              title: 'Результат запуска спутника',
              fields: [
                { name: 'Пользователь', value: `<@${userId}>`, inline: true },
                { name: 'Тип', value: type, inline: true },
                { name: 'Масса', value: `${mass} кг`, inline: true },
                { name: 'Тех. прогресс', value: techLevel, inline: true },
                { name: 'Статус', value: outcomeText, inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }).catch(err => console.error('Error sending satellite result:', err));
        });
      }
    }
  });
};