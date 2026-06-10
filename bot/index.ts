import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
  TextChannel,
  ButtonInteraction,
  Guild,
} from 'discord.js';

const SUPPORT_CHANNEL_ID = '1488376250496974868';
const MOD_ROLE_ID = process.env.DISCORD_MOD_ROLE_ID;

// ──────────────────────────────────────────────
// Helpers de ticket
// ──────────────────────────────────────────────

async function sendSupportMessage(guild: Guild) {
  const channel = guild.channels.cache.get(SUPPORT_CHANNEL_ID) as TextChannel | undefined;
  if (!channel) throw new Error(`Canal ${SUPPORT_CHANNEL_ID} não encontrado.`);

  const embed = new EmbedBuilder()
    .setTitle('🎫 Suporte')
    .setDescription(
      'Se tiver dúvida ou precisar de ajuda, clique no botão abaixo e abra um ticket para iniciar o atendimento.'
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('Iniciar')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫')
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ Mensagem de suporte enviada!');
}

async function handleTicketCreate(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  const existing = guild.channels.cache.find(ch => ch.name === channelName);
  if (existing) {
    await interaction.editReply({ content: `Você já tem um ticket aberto: <#${existing.id}>` });
    return;
  }

  let category = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === 'Tickets'
  );
  if (!category) {
    category = await guild.channels.create({
      name: 'Tickets',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }],
    });
  }

  const permissionOverwrites: Parameters<Guild['channels']['create']>[0]['permissionOverwrites'] = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    },
    {
      id: guild.ownerId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    },
  ];

  if (MOD_ROLE_ID) {
    permissionOverwrites.push({
      id: MOD_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites,
  });

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Encerrar Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

  await ticketChannel.send({
    content: `Olá <@${user.id}>! Um moderador irá te atender em breve.\n\nDigite sua dúvida aqui. Quando terminar, clique em **Encerrar Ticket**.`,
    components: [closeRow],
  });

  await interaction.editReply({ content: `✅ Ticket criado! <#${ticketChannel.id}>` });
  console.log(`🎫 Ticket aberto para ${user.tag}`);
}

async function handleTicketClose(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel;
  const user = interaction.user;

  await interaction.reply({
    content: `🔒 **${user.username}** encerrou o ticket. Canal será deletado em 5 segundos...`,
  });

  setTimeout(async () => {
    try { await channel.delete(); } catch {}
  }, 5000);
}

// ──────────────────────────────────────────────
// Bot
// ──────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot online como ${c.user.tag}`);

  const guild = c.guilds.cache.get(process.env.DISCORD_GUILD_ID!);
  if (!guild) return console.error('❌ Guild não encontrada.');

  const supportChannel = guild.channels.cache.get(SUPPORT_CHANNEL_ID) as TextChannel | undefined;
  if (!supportChannel) {
    console.error(`❌ Canal de suporte ${SUPPORT_CHANNEL_ID} não encontrado.`);
    return;
  }

  const messages = await supportChannel.messages.fetch({ limit: 10 });
  const alreadySent = messages.some(
    m => m.author.id === c.user.id && m.components.length > 0
  );

  if (!alreadySent) {
    await sendSupportMessage(guild).catch(console.error);
  } else {
    console.log('ℹ️  Mensagem de suporte já existe no canal.');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === 'ticket_create') await handleTicketCreate(interaction);
    else if (interaction.customId === 'ticket_close') await handleTicketClose(interaction);
  } catch (err) {
    console.error('Erro no ticket:', err);
    const msg = { content: '❌ Ocorreu um erro. Tente novamente.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
