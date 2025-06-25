const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'resetbal',
  description: 'Сбросить баланс пользователя (только для админов)',
  async execute(message, args, db) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Нужны права администратора')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (args.length < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя: !resetbal @user')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    const user = message.mentions.users.first();

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, 0)', [user.id], err => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при сбросе баланса')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Сброс баланса')
        .setDescription(`Баланс ${user.username} успешно сброшен`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};