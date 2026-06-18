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
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

const SUPPORT_CHANNEL_ID = '1488376250496974868';
const MOD_ROLE_ID = process.env.DISCORD_MOD_ROLE_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com';

// ──────────────────────────────────────────────
// KV helper (Upstash REST)
// ──────────────────────────────────────────────

async function kvGet(key: string): Promise<string | null> {
  const url  = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/${encodeURIComponent('get')}/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return null;
  }
}

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

  const permissionOverwrites = [
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
    ...(MOD_ROLE_ID ? [{
      id: MOD_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    }] : []),
  ];

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
// Slash commands — pets
// ──────────────────────────────────────────────

const ELEMENT_EMOJI: Record<string, string> = {
  'Fogo':'🔥', 'Água':'💧', 'Terra':'🪨', 'Ar':'🌪️',
  'Luz':'✨', 'Sombra':'🌑', 'Gelo':'❄️', 'Natureza':'🌿',
};

async function handleMeuPet(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const raw = await kvGet(`pets:${interaction.user.id}`);
  if (!raw) {
    await interaction.editReply({
      content: `🐾 Você ainda não tem bichinhos!\nAcesse ${BASE_URL}/pets para começar.`,
    });
    return;
  }

  let data: any;
  try { data = JSON.parse(raw); } catch {
    await interaction.editReply({ content: '❌ Erro ao ler seus dados.' });
    return;
  }

  const activePet = data.activePetId
    ? data.ownedPets?.find((p: any) => p.instanceId === data.activePetId)
    : null;

  if (!activePet) {
    await interaction.editReply({
      content: `Você tem **${data.ownedPets?.length ?? 0}** bichinho(s) mas nenhum ativo.\nAcesse ${BASE_URL}/pets para selecionar.`,
    });
    return;
  }

  const elementEmoji = ELEMENT_EMOJI[activePet.element] ?? '❓';

  const embed = new EmbedBuilder()
    .setTitle(`${elementEmoji} ${activePet.name}`)
    .setColor(0xFFD700)
    .setDescription(`Bichinho ativo de **${interaction.user.displayName}**`)
    .addFields(
      { name: '📊 Nível',    value: String(activePet.level),          inline: true },
      { name: '🔮 Elemento', value: activePet.element,                inline: true },
      { name: '✨ Raridade', value: activePet.rarity ?? '—',          inline: true },
      { name: '⭐ Pontos',   value: String(data.points ?? 0),         inline: true },
      { name: '🥚 Ovos',    value: String(data.ownedEggs?.length ?? 0), inline: true },
      { name: '🐾 Coleção', value: String(data.ownedPets?.length ?? 0), inline: true },
    )
    .setFooter({ text: `Acesse ${BASE_URL}/pets para jogar!` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePets(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🐾 Sistema de Bichinhos')
    .setColor(0x5865F2)
    .setDescription('Colete, evolua e batalhe com seus bichinhos!')
    .addFields(
      { name: '🥚 Ovos',    value: 'Incube ovos e eclodam novos pets', inline: true },
      { name: '🎰 Cápsula', value: 'Gaste pontos para ganhar recompensas', inline: true },
      { name: '⚔️ Arena',   value: 'Desafie outros jogadores em batalhas PvP', inline: true },
      { name: '🎮 Mini-games', value: 'Pulo, Alimentar, Banho — ganhe pontos!', inline: true },
    )
    .setURL(`${BASE_URL}/pets`)
    .setFooter({ text: 'Clique no link acima para acessar' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ──────────────────────────────────────────────
// Registro de slash commands
// ──────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('meu-pet')
    .setDescription('Mostra seu bichinho ativo no sistema de pets')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('pets')
    .setDescription('Informações sobre o sistema de bichinhos do Brasil Role BR')
    .toJSON(),
];

async function registerCommands() {
  const token   = process.env.DISCORD_BOT_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const guildId  = process.env.DISCORD_GUILD_ID!;

  if (!token || !clientId || !guildId) {
    console.warn('⚠️ DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID ausentes — slash commands não registrados.');
    return;
  }

  const rest = new REST().setToken(token);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ ${commands.length} slash command(s) registrado(s) na guild ${guildId}`);
  } catch (err) {
    console.error('❌ Erro ao registrar slash commands:', err);
  }
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

  await registerCommands();

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
  // Slash commands
  if (interaction.isChatInputCommand()) {
    try {
      if (interaction.commandName === 'meu-pet') await handleMeuPet(interaction);
      else if (interaction.commandName === 'pets') await handlePets(interaction);
    } catch (err) {
      console.error('Erro no slash command:', err);
      const msg = { content: '❌ Ocorreu um erro. Tente novamente.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
    return;
  }

  // Botões de ticket
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
