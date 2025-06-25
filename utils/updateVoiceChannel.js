const moment = require('moment-timezone');
const { PermissionsBitField } = require('discord.js');

module.exports = {
  startVoiceChannelUpdate: (client, config, db) => {
    if (!client.isReady()) {
      console.error('клаент');
      return;
    }

    const updateChannelName = async () => {
      try {
        console.log(`Изменение ${config.voiceChannelId}...`);

        if (!config.guildId) {
          console.error('guildId not set in config.json');
          return;
        }

        if (!config.voiceChannelId) {
          console.error('voiceChannelId not set in config.json');
          return;
        }

        if (!client.guilds) {
          console.error('client.guilds is undefined');
          return;
        }

        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) {
          console.error(`Guild ${config.guildId} not found in cache. Available guilds: ${client.guilds.cache.map(g => g.id).join(', ')}`);
          return;
        }

        const channel = await guild.channels.cache.get(config.voiceChannelId) || await guild.channels.fetch(config.voiceChannelId).catch((err) => {
          console.error(`Error fetching voice channel ${config.voiceChannelId}:`, err);
          return null;
        });

        if (!channel || channel.type !== 2) { 
          console.error(`ноу ${config.voiceChannelId} ф`);
          return;
        }

        const botPermissions = channel.permissionsFor(client.user);
        if (!botPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
          console.error(`Missing MANAGE_CHANNELS permission in channel ${config.voiceChannelId}`);
          return;
        }

        const row = await new Promise((resolve, reject) => {
          db.get('SELECT value FROM settings WHERE key = ?', ['baseYear'], (err, row) => {
            err ? reject(err) : resolve(row);
          });
        });
        const baseYear = row ? parseInt(row.value) : 1930;

        const now = moment().tz('Europe/Kiev');
        const hours = now.hours();
        const minutes = now.minutes();
        const totalMinutes = hours * 60 + minutes;
        const gameDay = Math.floor(totalMinutes / 8) % 30 + 1;
        const months = [
          'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const monthIndex = Math.floor((hours % 48) / 4);
        const monthName = months[monthIndex];
        const gameYear = baseYear + Math.floor((totalMinutes / 8) / 360);
        const gameDate = `${gameDay} ${monthName} ${gameYear}`;

        if (channel.name !== gameDate) {
          await channel.setName(`🕊・Дата: ${gameDate}`).catch((err) => {
            console.error(`Error updating channel ${config.voiceChannelId} name:`, err);
          });
          console.log(`Измененоо: ${gameDate}`);
        } else {
          console.log(`Уже: ${gameDate}`);
        }
      } catch (err) {
        console.error('ошибка:', err.message);
      }
    };

    console.log('старт...');
    updateChannelName();
    setInterval(updateChannelName, 60 * 1000);
  },
};