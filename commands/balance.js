const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'b'],
  description: 'Показать баланс пользователя',
  async execute(message, args, db) {
    let targetUser = message.author;
    if (args.length > 0 && message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    }

    const userId = targetUser.id;
    const displayName = `${targetUser.username}`;
    const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 128 });

    db.get('SELECT balance FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#9B909E')
          .setTitle('Ошибка')
          .setDescription('Ошибка при получении баланса')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const balance = row ? row.balance : 0;
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle(`Баланс ${displayName}`)
        .addFields(
            { name: 'Баланс', value: `${config.cur} *${balance}* ` },
        )
        .setThumbnail(avatarUrl)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};