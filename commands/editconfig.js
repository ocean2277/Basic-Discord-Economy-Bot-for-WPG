const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'editconfig',
  description: 'Редактировать параметры конфигурации (только для владельца сервера)',
  async execute(message, args) {
    if (message.author.id !== message.guild.ownerId) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Эта команда доступна только владельцу сервера')
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription(
          'Использование: ```!editconfig <ключ> <значение>```\n' +
          'или ```!editconfig добавитьроль <roleId> <сумма>```\n' +
          'или ```!editconfig удалитьроль <roleId>```\n\n' +
          'Доступные ключи:\n' +
          '- voiceChannelId, auditWebhookUrl, webhookId, webhookToken, adminRoleId, cur, guildId, ' +
          'investmentResultChannelId, spyCategoryId, satelliteResultChannelId\n' +
          '- progressRoles1–6 (для progressRoles[0–5])\n\n' +
          'Примеры:\n' +
          '```!editconfig cur ❤️\n' +
          '!editconfig voiceChannelId 1384151066488078456\n' +
          '!editconfig progressRoles1 1384153967189032970\n' +
          '!editconfig auditWebhookUrl https://discord.com/api/webhooks/123/abc\n' +
          '!editconfig добавитьроль 123456789012345678 500\n' +
          '!editconfig удалитьроль 123456789012345678```'
        )
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const action = args[0].toLowerCase();
    let currentConfig;

    try {
      currentConfig = require('../config.json');
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Ошибка при чтении конфигурации')
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const validIdRegex = /^\d{18,20}$/;
    const validWebhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d{18,20}\/[\w-]+$/;

    const simpleParams = [
      'voiceChannelId', 'webhookId', 'adminRoleId', 'guildId',
      'investmentResultChannelId', 'spyCategoryId', 'satelliteResultChannelId'
    ];
    const webhookParams = ['auditWebhookUrl', 'webhookToken'];
    const freeTextParams = ['cur'];

    if (simpleParams.includes(action)) {
      if (args.length !== 2) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Использование: \`\`\`!editconfig ${action} <ID>\`\`\``)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const value = args[1];
      if (!validIdRegex.test(value)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('ID должен состоять из 18-20 цифр')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      currentConfig[action] = value;
      await saveConfig(message, currentConfig, action, value);
    } else if (webhookParams.includes(action)) {
      if (args.length !== 2) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Использование: \`\`\`!editconfig ${action} <значение>\`\`\``)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const value = args[1];
      if (action === 'auditWebhookUrl' && !validWebhookRegex.test(value)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('URL вебхука должен быть в формате: ```https://discord.com/api/webhooks/<id>/<token>```')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      currentConfig[action] = value;
      await saveConfig(message, currentConfig, action, value);
    } else if (freeTextParams.includes(action)) {
      if (args.length !== 2) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Использование: \`\`\`!editconfig ${action} <значение>\`\`\``)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const value = args[1];
      currentConfig[action] = value;
      await saveConfig(message, currentConfig, action, value);
    } else if (/^progressroles[1-6]$/.test(action)) {
      if (args.length !== 2) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Использование: \`\`\`!editconfig ${action} <roleId>\`\`\``)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const roleId = args[1];
      if (!validIdRegex.test(roleId)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('ID роли должен состоять из 18-20 цифр')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const index = parseInt(action.match(/\d$/)[0]) - 1;
      currentConfig.progressRoles[index] = roleId;
      await saveConfig(message, currentConfig, `progressRoles[${index}]`, roleId);
    } else if (action === 'добавитьроль') {
      if (args.length !== 3) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Использование: ```!editconfig добавитьроль <roleId> <сумма>```')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const roleId = args[1];
      const amount = parseInt(args[2]);

      if (!validIdRegex.test(roleId)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('ID роли должен состоять из 18-20 цифр')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (isNaN(amount) || amount <= 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Сумма должна быть положительным целым числом')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (currentConfig.incomeRoles.some((role) => role.roleId === roleId)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Роль с ID ${roleId} уже есть в incomeRoles`)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      currentConfig.incomeRoles.push({ roleId, amount });
      await saveConfig(message, currentConfig, 'incomeRoles', `Added { roleId: ${roleId}, amount: ${amount} }`);
    } else if (action === 'удалитьроль') {
      if (args.length !== 2) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Использование: ```!editconfig удалитьроль <roleId>```')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const roleId = args[1];
      if (!validIdRegex.test(roleId)) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('ID роли должен состоять из 18-20 цифр')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const index = currentConfig.incomeRoles.findIndex((role) => role.roleId === roleId);
      if (index === -1) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Роль с ID ${roleId} не найдена в incomeRoles`)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      currentConfig.incomeRoles.splice(index, 1);
      await saveConfig(message, currentConfig, 'incomeRoles', `Removed roleId: ${roleId}`);
    } else {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription(
          'Неверный ключ. Доступные ключи:\n' +
          '```voiceChannelId, auditWebhookUrl, webhookId, webhookToken, adminRoleId, cur, guildId, ' +
          'investmentResultChannelId, spyCategoryId, satelliteResultChannelId, progressRoles1–6, ' +
          'добавитьроль, удалитьроль```'
        )
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
  },
};

async function saveConfig(message, config, key, value) {
  try {
    fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(config, null, 2));
    delete require.cache[require.resolve('../config.json')];
    const updatedConfig = require('../config.json');

    const embed = new EmbedBuilder()
      .setColor('#9B909E')
      .setTitle('Успех')
      .setDescription(`Параметр **${key}** обновлён: ${value}`)
      .setFields([{ name: 'Новый конфиг', value: `\`\`\`json\n${JSON.stringify(updatedConfig, null, 2)}\n\`\`\`` }])
      .setFooter({ text: message.client.user.username })
      .setTimestamp();
    await message.channel.send({ embeds: [embed] });

    console.log(`Config updated by ${message.author.tag}: ${key} = ${value}`);
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Ошибка')
      .setDescription(`Ошибка при сохранении конфига: ${error.message}`)
      .setFooter({ text: message.client.user.username })
      .setTimestamp();
    await message.channel.send({ embeds: [embed] });
  }
}