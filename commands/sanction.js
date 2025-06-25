const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'sanction',
  description: 'Установить санкцию в процентах (только для админов)',
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

    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя и процент: \n```!sanction @юзер процент```')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    const user = message.mentions.users.first();
    const percent = parseInt(args[1]);

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    if (isNaN(percent) || percent < 0 || percent > 100) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Процент должен быть от 0 до 100')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.run('INSERT OR REPLACE INTO users (userId, sanction) VALUES (?, ?)', [user.id, percent], err => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при установке санкции')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Санкции')
        .setDescription(`*Успешно установлена санкция ${percent}% для ${user.username}*`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};