/**
 * Slash commands typed into the chat box.
 *
 * Everyone gets `/help` and `/report`; moderators get the rest. Commands are
 * intercepted before the message reaches the engine, so an ordinary player can
 * never send one another player's client a command they did not type.
 */

import { REPORT_REASONS, describePenalty } from './moderation.js';
import { describeWait } from './limits.js';

const PLAYER_HELP = [
  '/help - this list',
  '/report <name> [reason] - tell a moderator about a player',
  '/who - who is online'
];

const MOD_HELP = [
  '/mute <name> <minutes> [reason] - stop someone chatting (0 = until lifted)',
  '/unmute <name>',
  '/kick <name> [reason] - disconnect someone',
  '/ban <name> <hours> [reason] - keep someone out (0 = until lifted)',
  '/unban <name>',
  '/reports [count] - recent reports',
  '/mod <name> / /unmod <name> - grant or remove moderator',
  '/say <message> - announce to everyone'
];

export function isCommand(text) {
  return typeof text === 'string' && text.startsWith('/');
}

/**
 * Runs a command.
 *
 * @param ctx.session      the caller's session
 * @param ctx.moderation   ModerationStore
 * @param ctx.reply        (text, channel) => void, to the caller
 * @param ctx.announce     (text) => void, to everyone
 * @param ctx.findSession  (name) => session | null
 * @param ctx.disconnect   (session, reason) => void
 * @param ctx.onlineNames  () => string[]
 * @returns {Promise<boolean>} true when the text was a command (handled or refused)
 */
export async function runCommand(text, ctx) {
  const [rawCommand, ...rest] = text.slice(1).trim().split(/\s+/);
  const command = (rawCommand || '').toLowerCase();
  const { session, moderation, reply } = ctx;
  const isMod = moderation.isAdmin(session.name);

  switch (command) {
    case 'help': {
      reply('Commands:', 'system');
      for (const line of PLAYER_HELP) reply(line, 'system');
      if (isMod) {
        reply('Moderator commands:', 'system');
        for (const line of MOD_HELP) reply(line, 'system');
      }
      return true;
    }

    case 'who': {
      const names = ctx.onlineNames();
      reply(`${names.length} online: ${names.join(', ')}`, 'system');
      return true;
    }

    case 'report': {
      const target = rest.shift();
      if (!target) {
        reply('Use /report <name> [what happened]. Reasons: ' + REPORT_REASONS.map((r) => r.id).join(', '), 'system');
        return true;
      }
      const note = rest.join(' ');
      const reasonId = REPORT_REASONS.find((r) => r.id === (rest[0] || '').toLowerCase())?.id || 'other';
      const result = await moderation.addReport({
        reporter: session.name,
        target,
        reason: reasonId,
        note
      });
      reply(
        result.ok
          ? 'Thank you. A moderator will read your report. You did the right thing telling someone.'
          : result.reason,
        'system'
      );
      if (result.ok) ctx.notifyModerators?.(`New report from ${session.name} about ${target} (${reasonId}).`);
      return true;
    }

    // ------------------------------------------------------------ moderator

    case 'mute':
    case 'unmute':
    case 'kick':
    case 'ban':
    case 'unban':
    case 'reports':
    case 'mod':
    case 'unmod':
    case 'say': {
      if (!isMod) {
        reply('That command is for moderators.', 'system');
        return true;
      }
      return handleModCommand(command, rest, ctx);
    }

    default:
      reply(`Unknown command "/${command}". Try /help.`, 'system');
      return true;
  }
}

async function handleModCommand(command, rest, ctx) {
  const { session, moderation, reply } = ctx;
  const by = session.name;

  const targetName = rest.shift();
  const needsTarget = ['mute', 'unmute', 'kick', 'ban', 'unban', 'mod', 'unmod'].includes(command);
  if (needsTarget && !targetName) {
    reply(`Use /${command} <name> ...`, 'system');
    return true;
  }

  switch (command) {
    case 'mute': {
      const minutes = Number(rest.shift()) || 0;
      const reason = rest.join(' ');
      const entry = moderation.mute(targetName, minutes, reason, by);
      reply(`Muted ${targetName}${minutes ? ` for ${minutes} minute(s)` : ' until lifted'}.`, 'system');
      ctx.findSession(targetName)?.conn.sendJson({ t: 'msg', text: describePenalty(entry, 'muted'), channel: 'system' });
      log('mute', by, targetName, reason);
      return true;
    }

    case 'unmute': {
      const existed = moderation.unmute(targetName);
      reply(existed ? `${targetName} may chat again.` : `${targetName} was not muted.`, 'system');
      if (existed) {
        ctx.findSession(targetName)?.conn.sendJson({ t: 'msg', text: 'Your mute has been lifted. Please keep it kind.', channel: 'system' });
        log('unmute', by, targetName, '');
      }
      return true;
    }

    case 'kick': {
      const target = ctx.findSession(targetName);
      if (!target) {
        reply(`${targetName} is not online.`, 'system');
        return true;
      }
      const reason = rest.join(' ') || 'A moderator asked you to take a break.';
      target.conn.sendJson({ t: 'msg', text: reason, channel: 'system' });
      ctx.disconnect(target, reason);
      target.conn.close(1000, 'Kicked');
      reply(`Kicked ${targetName}.`, 'system');
      log('kick', by, targetName, reason);
      return true;
    }

    case 'ban': {
      const hours = Number(rest.shift()) || 0;
      const reason = rest.join(' ');
      const entry = moderation.ban(targetName, hours, reason, by);
      const target = ctx.findSession(targetName);
      if (target) {
        target.conn.sendJson({ t: 'msg', text: describePenalty(entry, 'banned'), channel: 'system' });
        ctx.disconnect(target, 'Banned');
        target.conn.close(1000, 'Banned');
      }
      reply(`Banned ${targetName}${hours ? ` for ${hours} hour(s)` : ' until lifted'}.`, 'system');
      log('ban', by, targetName, reason);
      return true;
    }

    case 'unban': {
      const existed = moderation.unban(targetName);
      reply(existed ? `${targetName} may return.` : `${targetName} was not banned.`, 'system');
      if (existed) log('unban', by, targetName, '');
      return true;
    }

    case 'mod': {
      moderation.grantAdmin(targetName);
      reply(`${targetName} is now a moderator.`, 'system');
      log('mod', by, targetName, '');
      return true;
    }

    case 'unmod': {
      moderation.revokeAdmin(targetName);
      reply(`${targetName} is no longer a moderator.`, 'system');
      log('unmod', by, targetName, '');
      return true;
    }

    case 'reports': {
      const count = Math.min(20, Math.max(1, Number(targetName) || 5));
      const reports = await moderation.recentReports(count);
      if (!reports.length) {
        reply('No reports yet.', 'system');
        return true;
      }
      for (const report of reports) {
        reply(`[${report.id}] ${report.reporter} reported ${report.target} - ${report.reason}${report.note ? `: ${report.note}` : ''}`, 'system');
      }
      reply(`Full context is in reports.jsonl.`, 'system');
      return true;
    }

    case 'say': {
      const message = [targetName, ...rest].filter(Boolean).join(' ');
      if (!message) {
        reply('Use /say <message>.', 'system');
        return true;
      }
      ctx.announce(`[Moderator] ${message}`);
      log('say', by, '-', message);
      return true;
    }

    default:
      return true;
  }
}

/** Every moderator action is written to the server log with who and why. */
function log(action, by, target, reason) {
  console.log(`[mod] ${action} by=${by} target=${target}${reason ? ` reason=${reason}` : ''}`);
}

export function loginRefusalMessage(wait) {
  return `Too many attempts. Please wait ${describeWait(wait)} and try again.`;
}
