const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
  name: 'queue',
  description: 'Просмотр очередей производства и ожидания',
  async execute(message, args, db) {
    console.log(`!queue executed by ${message.author.id}`);
    const userId = message.author.id;

    function getGameDate(timestamp) {
      const now = moment(timestamp).tz('Europe/Kiev');
      const hours = now.hours();
      const minutes = now.minutes();
      const totalMinutes = hours * 60 + minutes;
      return Math.floor(totalMinutes / 8);
    }

    const currentTime = Date.now();
    const currentGameDays = getGameDate(currentTime);

    db.all('SELECT * FROM production_queue WHERE userId = ?', [userId], (err, prodQueue) => {
      if (err) {
        console.error('Error fetching production queue:', err);
        return message.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Ошибка при получении очереди производства',
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
      }

      db.all('SELECT * FROM waiting_queue WHERE userId = ?', [userId], (err, waitQueue) => {
        if (err) {
          console.error('Error fetching waiting queue:', err);
          return message.reply({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при получении листа ожидания',
              timestamp: new Date().toISOString(),
            }],
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x9b909e)
          .setTitle('Очередь производства и лист ожидания')
          .addFields(
            {
              name: 'Очередь производства',
              value: prodQueue.length
                ? prodQueue.map(item => `${item.itemName} (${item.quantity} шт., прогресс ${item.progressLevel}, завершение через ${item.endDate - currentGameDays} дн.)`).join('\n')
                : 'пуста',
            },
            {
              name: 'Лист ожидания',
              value: waitQueue.length
                ? waitQueue.map(item => `${item.itemName} (${item.quantity} шт., прогресс ${item.progressLevel})`).join('\n')
                : 'пуст',
            }
          )
          .setTimestamp();

        message.reply({ embeds: [embed] });
      });
    });
  },
};