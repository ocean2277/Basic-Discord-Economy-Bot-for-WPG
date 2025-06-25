const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'adminhelp',
  description: 'Показывает список всех команд, включая админские',
  async execute(message, args, db, auditWebhook) {
    const member = message.guild.members.cache.get(message.author.id);
    if (!member.roles.cache.has(config.adminRoleId)) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('У вас нет прав администратора для использования этой команды!')
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const commands = [
      {
        name: '!editshop',
        description: 'Редактирование предметов в магазине.',
        example: '!editshop add Танк 9000 10 "Крутой танк"'
      },
      {
        name: '!editshop2',
        description: 'Редактирование акций в магазине.',
        example: '!editshop2 add Microsoft 5000 120 "Акции компании майкрософт"'
      },
      {
        name: '!give',
        description: 'Выдать деньги пользователю.',
        example: '!give @user 10000'
      },
      {
        name: '!giveitem',
        description: 'Выдать предмет пользователю.',
        example: '!giveitem @user Танк '
      },
      {
        name: '!resetbal',
        description: 'Сбросить баланс пользователя.',
        example: '!resetbal @user'
      },
      {
        name: '!sanction',
        description: 'Установить санкцию в процентах.',
        example: '!sanction @user 30'
      },
      {
        name: '!setbal',
        description: 'Установить баланс пользователя.',
        example: '!setbal @user 12000'
      },
      {
        name: '!take',
        description: 'Забрать деньги у пользователя.',
        example: '!take @user 8000'
      },
      {
        name: '!takeitem',
        description: 'Забрать предмет у пользователя.',
        example: '!takeitem @user Танк'
      },
      {
        name: '!unsanction',
        description: 'Снять санкцию с пользователя.',
        example: '!unsanction @user'
      },
      {
        name: '!adminhelp',
        description: 'Показывает этот список всех команд.',
        example: '!adminhelp'
      },
      {
        name: '!vaip',
        description: 'Очистить балансы, инвентари и второй магазин (только для владельца сервера)',
        example: '!vaip'
      },
      {
        name: '!banbuy',
        description: 'Запретить или разрешить пользователю покупать предметы',
        example: '!banbuy <ban|unban> <@пользователь>'
      },
      {
        name: '!createspy',
        description: 'Создать шпиона в магазине',
        example: '!createspy <Название шпиона> <цена> <время обучения> [описание]'
      },
            {
        name: '/dm',
        description: 'Отправить сообщение в ЛС от лица бота',
        example: '/dm'
      },
      {
        name: '!invest-info',
        description: 'Просмотр инвестиций пользователя',
        example: '!invest-info @user'
      },
      {
        name: '!startdate',
        description: 'Установить базовый год для игровой даты',
        example: '!startdate 2024'
      }
      
    ];

    const embed = new EmbedBuilder()
      .setColor('#9B909E')
      .setTitle('Список админских команд')
      .setDescription('Все команды, включая админские. Админские команды помечены **[Админ]**.')
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