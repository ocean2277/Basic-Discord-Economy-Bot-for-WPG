const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'pay',
  description: 'Перевести деньги другому пользователю',
  async execute(message, args, db) {
    let targetUser = message.author;
    let targetUserId = message.author.id;
    let targetDisplayName = message.author.username;
    const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 128 });
    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя и сумму:\n ```!pay @юзер количество```')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    const user = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    if (isNaN(amount) || amount <= 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Сумма должна быть положительным числом')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const senderId = message.author.id;
    if (senderId === user.id) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Нельзя перевести деньги самому себе')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.get('SELECT balance FROM users WHERE userId = ?', [senderId], (err, row) => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при проверке баланса')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const senderBalance = row ? row.balance : 0;

      if (senderBalance < amount) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Недостаточно средств')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) - ?, 0))', 
        [senderId, senderId, amount]);
      db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) + ?, 0))', 
        [user.id, user.id, amount]);
      
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Перевод')
        .setDescription(`Успешно переведено ${amount} ${config.cur} пользователю ${user.username}`)
        .setFooter({ text: message.author.username })
        .setThumbnail(avatarUrl)
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};