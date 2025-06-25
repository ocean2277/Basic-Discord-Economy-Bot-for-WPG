const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'unsanction',
  description: 'Снять санкцию с пользователя (только для админов)',
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
        .setDescription('Укажите пользователя: !unsanction @user')
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

    db.run('UPDATE users SET sanction = 0 WHERE userId = ?', [user.id], err => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при снятии санкции')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Снятие санкции')
        .setDescription(`Снята санкция с ${user.username}`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};