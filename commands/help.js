const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Показывает список доступных команд',
  async execute(message, args, db, auditWebhook) {
    const commands = [
      {
        name: '!balance',
        description: 'Показывает ваш текущий баланс.',
        example: '!balance'
      },
      {
        name: '!buy',
        description: 'Покупает предмет из магазина или второго магазина.',
        example: '!buy Танк 10'
      },
      {
        name: '!shop',
        description: 'Показывает список предметов в первом магазине.',
        example: '!shop'
      },
      {
        name: '!shop2',
        description: 'Показывает список предметов во втором магазине.',
        example: '!shop2'
      },
      {
        name: '!sell',
        description: 'Продаёт предмет из инвентаря (первый магазин).',
        example: '!sell Танк 500 @user'
      },
      {
        name: '!sell2',
        description: 'Продаёт предмет из инвентаря (второй магазин).',
        example: '!sell2 Танк 5'
      },
      {
        name: '!inventory',
        description: 'Показывает ваш инвентарь.',
        example: '!inventory'
      },
      {
        name: '!use',
        description: 'Использует предмет из инвентаря.',
        example: '!use Танк'
      },
      {
        name: '!queue',
        description: 'Показывает очередь производства и лист ожидания.',
        example: '!queue'
      },
      {
        name: '!data',
        description: 'Посмотреть текущую дату.',
        example: '!data'
      },
      {
        name: '!pay',
        description: 'Перевести деньги игроку.',
        example: '!pay @user 1000'
      },
      {
        name: '!help',
        description: 'Показывает этот список команд.',
        example: '!help'
      },
            {
        name: '!case',
        description: 'Показывает ваши акции.',
        example: '!case'
      },
            {
        name: '!invest',
        description: 'Инвестиции.',
        example: '!invest'
      },
            {
        name: '!satellite',
        description: 'Показывает меню спутников.',
        example: '!satellite'
      },
            {
        name: '!spy',
        description: 'Показывает меню шпионов.',
        example: '!spy'
      }
    ];

    const embed = new EmbedBuilder()
      .setColor('#9B909E')
      .setTitle('Список команд')
      .setDescription('Вот все доступные команды и их описание:')
      .setFooter({ text: message.author.username })
      .setTimestamp();

    commands.forEach(cmd => {
      embed.addFields({
        name: cmd.name,
        value: `${cmd.description}\n**Пример:** \`${cmd.example}\``,
        inline: false
      });
    });

    await message.channel.send({ embeds: [embed] });
  },
};