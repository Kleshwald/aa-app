import { faker } from './seed';

import type {
  SupportChatThread,
  SupportNote,
  SupportRequestDetail,
} from '@core/services/support.model';
import type {
  ProcessKind,
  ProcessStatus,
  ProcessStatusEvent,
} from '@core/services/process.service';

// Очередь поддержки НЕ может состоять из одного демо-агента: смысл кокпита виден
// только когда в списке разные агенты, регионы и СК, и приходится выбирать, за что
// браться. Поэтому здесь — «чужие» заявки и диалоги (статичные, на сессию), а заявки
// и чат самого демо-агента подмешивает handler из живых фикстур: действия поддержки
// по ним сразу видны в кабинете агента.

const SUPPORT_NAME = 'Поддержка Agent Academy';
const OPERATOR = 'Статьева Елена Владимировна';

function agoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function agoDays(days: number): string {
  return agoIso(days * 24 * 60);
}
function aheadDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

let counter = 12930;
function nextRequestNumber(): string {
  counter += 1;
  return String(counter).padStart(9, '0');
}

interface OtherAgent {
  name: string;
  ikp: string;
  phone: string;
  region: string;
  curator: string;
}

/** Агенты сети — соседи демо-агента по региону (Хакасия / юг Красноярского края). */
const AGENTS: OtherAgent[] = [
  {
    name: 'Ерошкина Наталья Петровна',
    ikp: '41287',
    phone: '+7 913 445-21-08',
    region: 'Абакан',
    curator: 'Парфенова Оксана Анатольевна',
  },
  {
    name: 'Тохтобин Сергей Иванович',
    ikp: '38104',
    phone: '+7 923 118-64-37',
    region: 'Минусинск',
    curator: 'Парфенова Оксана Анатольевна',
  },
  {
    name: 'Кыжинаева Айсуу Борисовна',
    ikp: '50921',
    phone: '+7 983 250-77-14',
    region: 'Кызыл',
    curator: 'Демидова Ирина Сергеевна',
  },
  {
    name: 'Полежаев Андрей Николаевич',
    ikp: '33645',
    phone: '+7 902 963-40-52',
    region: 'Черногорск',
    curator: 'Демидова Ирина Сергеевна',
  },
  {
    name: 'Сагалакова Вера Михайловна',
    ikp: '47830',
    phone: '+7 950 307-19-96',
    region: 'Саяногорск',
    curator: 'Парфенова Оксана Анатольевна',
  },
];

interface SeedRequest {
  agent: OtherAgent;
  kind: ProcessKind;
  status: ProcessStatus;
  reasons: string[];
  insurer: string;
  policyNumber: string;
  policyholder: string;
  owner?: string;
  vehicle: string;
  premium: number;
  openedMinutesAgo: number;
  lastMoveMinutesAgo: number;
  assignee: string | null;
  refundAmount?: number;
  lossNumber?: string;
  payoutAmount?: number;
  notes?: SupportNote[];
  comments?: { at: string; from: 'agent' | 'support'; text: string }[];
  /** Работа ушла наружу — в СК (почта/чат). Агенту виден только итог. */
  atInsurer?: boolean;
}

/**
 * История статусов по виду и текущему состоянию. Держим коротко: карточке нужен
 * правдоподобный трек, а не полная легаси-модель (её дельта описана в
 * docs/knowledge/10-processes.md §5 — прототип живёт на 6 общих статусах).
 */
function historyFor(seed: SeedRequest, requestNumber: string): ProcessStatusEvent[] {
  const opened = seed.openedMinutesAgo;
  const last = seed.lastMoveMinutesAgo;
  const events: ProcessStatusEvent[] = [
    { at: agoIso(opened), status: 'submitted', author: 'agent', requestNumber },
  ];
  if (seed.status === 'submitted') return events;

  events.push({
    at: agoIso(Math.round((opened + last) / 2)),
    status: 'checking-docs',
    author: 'support',
    requestNumber,
    comment: 'Заявка зарегистрирована, идёт проверка документов',
  });
  if (seed.status === 'checking-docs') return events;

  events.push({
    at: agoIso(Math.round(last * 1.4)),
    status: 'in-work',
    author: 'support',
    requestNumber,
    comment: seed.atInsurer
      ? 'Запрос направлен в страховую компанию'
      : 'Ваша заявка принята в работу',
  });
  if (seed.status === 'in-work') return events;

  if (seed.status === 'awaiting-docs') {
    events.push({
      at: agoIso(last),
      status: 'awaiting-docs',
      author: 'support',
      requestNumber,
      comment: 'Приложите документы',
      docRequest: { title: 'Приложите документы', items: DOC_PRESETS[seed.kind] },
    });
  }
  return events;
}

/** Что поддержка обычно просит по виду заявки — пресеты для кнопки «Запросить документы». */
export const DOC_PRESETS: Record<ProcessKind, string[]> = {
  change: [
    'Предыдущее водительское удостоверение',
    'Паспорт страхователя (стр. 2–3)',
    'СТС / ПТС после изменения',
  ],
  cancel: ['Заявление о расторжении', 'Реквизиты для возврата премии', 'Договор купли-продажи ТС'],
  loss: ['Справка о ДТП', 'Фотографии повреждений', 'Извещение о ДТП (европротокол)'],
};

const SEEDS: SeedRequest[] = [
  {
    agent: AGENTS[0],
    kind: 'loss',
    status: 'in-work',
    reasons: [],
    insurer: 'Росгосстрах',
    policyNumber: 'ХХХ 0344182956',
    policyholder: 'Мамедов Руслан Тофикович',
    vehicle: 'Toyota Camry · А 421 УК 19',
    premium: 11_480,
    openedMinutesAgo: 3 * 24 * 60,
    lastMoveMinutesAgo: 380,
    assignee: OPERATOR,
    lossNumber: 'У-2026-004417',
    atInsurer: true,
    notes: [
      {
        at: agoIso(370),
        author: OPERATOR,
        text: 'Отправила пакет в РГС на claims@ — ждём номер убытка. Агенту сказала только «в работе у страховой».',
      },
    ],
    comments: [
      {
        at: agoIso(400),
        from: 'agent',
        text: 'Клиент звонит каждый день, что ему сказать по срокам?',
      },
    ],
  },
  {
    agent: AGENTS[1],
    kind: 'change',
    status: 'submitted',
    reasons: ['add-driver'],
    insurer: 'Ренессанс',
    policyNumber: 'ХХХ 0298551043',
    policyholder: 'Тохтобина Марина Андреевна',
    vehicle: 'Lada Granta · Е 907 НС 24',
    premium: 7_320,
    openedMinutesAgo: 55,
    lastMoveMinutesAgo: 55,
    assignee: null,
  },
  {
    agent: AGENTS[2],
    kind: 'cancel',
    status: 'awaiting-docs',
    reasons: [],
    insurer: 'Югория',
    policyNumber: 'ХХХ 0301774620',
    policyholder: 'Ондар Чойган Кежикович',
    vehicle: 'UAZ Patriot · К 158 ВВ 17',
    premium: 9_640,
    openedMinutesAgo: 2 * 24 * 60,
    lastMoveMinutesAgo: 26 * 60,
    assignee: 'Гончарова Марина Сергеевна',
    refundAmount: 4_120,
    comments: [
      {
        at: agoIso(25 * 60),
        from: 'support',
        text: 'Приложите заявление о расторжении и реквизиты для возврата премии.',
      },
    ],
  },
  {
    agent: AGENTS[3],
    kind: 'change',
    status: 'checking-docs',
    reasons: ['replace-plate-sts'],
    insurer: 'Согласие',
    policyNumber: 'ХХХ 0367112884',
    policyholder: 'Полежаева Елена Юрьевна',
    vehicle: 'Kia Rio · О 336 ТМ 19',
    premium: 8_150,
    openedMinutesAgo: 6 * 60,
    lastMoveMinutesAgo: 5 * 60,
    assignee: null,
  },
  {
    agent: AGENTS[4],
    kind: 'loss',
    status: 'awaiting-docs',
    reasons: [],
    insurer: 'СОГАЗ',
    policyNumber: 'ХХХ 0288304517',
    policyholder: 'Сагалаков Дмитрий Петрович',
    vehicle: 'Hyundai Solaris · Т 774 АХ 19',
    premium: 10_070,
    openedMinutesAgo: 5 * 24 * 60,
    lastMoveMinutesAgo: 2 * 24 * 60,
    assignee: OPERATOR,
    lossNumber: 'У-2026-004388',
    payoutAmount: 63_400,
  },
  {
    agent: AGENTS[0],
    kind: 'change',
    status: 'in-work',
    reasons: ['policy-error'],
    insurer: 'Зетта',
    policyNumber: 'ХХХ 0355901237',
    policyholder: 'Ерошкин Виктор Сергеевич',
    vehicle: 'Renault Duster · У 612 РК 19',
    premium: 6_890,
    openedMinutesAgo: 9 * 60,
    lastMoveMinutesAgo: 300,
    assignee: 'Абрамов Игорь Петрович',
    notes: [
      {
        at: agoIso(295),
        author: 'Абрамов Игорь Петрович',
        text: 'Ошибка в дате рождения собственника — правим через 2-ю линию (расчёты), КБМ пересчитается.',
      },
    ],
  },
];

/** «Чужие» заявки — живут на сессию и мутируются действиями поддержки. */
export const supportRequests: SupportRequestDetail[] = SEEDS.map((seed) => {
  const requestNumber = nextRequestNumber();
  return {
    id: faker.string.uuid(),
    requestNumber,
    kind: seed.kind,
    status: seed.status,
    reasons: seed.reasons,
    createdAt: agoIso(seed.openedMinutesAgo),

    policyId: '',
    policyNumber: seed.policyNumber,
    insurer: seed.insurer,
    policyholder: seed.policyholder,
    owner: seed.owner ?? seed.policyholder,
    vehicle: seed.vehicle,
    premium: seed.premium,
    startDate: agoDays(Math.round(seed.openedMinutesAgo / (24 * 60)) + 40),
    endDate: aheadDays(300),

    refundAmount: seed.refundAmount,
    lossNumber: seed.lossNumber,
    payoutAmount: seed.payoutAmount,

    agentName: seed.agent.name,
    agentIkp: seed.agent.ikp,
    agentPhone: seed.agent.phone,
    region: seed.agent.region,
    curatorName: seed.agent.curator,

    assignee: seed.assignee,
    statusHistory: historyFor(seed, requestNumber),
    comments: (seed.comments ?? []).map((c) => ({
      at: c.at,
      author: c.from,
      authorName: c.from === 'agent' ? seed.agent.name : SUPPORT_NAME,
      text: c.text,
    })),
    notes: seed.notes ?? [],
    attachments: [],
    live: false,
    atInsurer: seed.atInsurer ?? false,
  };
});

/** Диалоги чата других агентов (у демо-агента диалог живой — из ChatService). */
export const supportThreads: SupportChatThread[] = [
  {
    id: 'thread-eroshkina',
    agentName: AGENTS[0].name,
    agentIkp: AGENTS[0].ikp,
    agentPhone: AGENTS[0].phone,
    region: AGENTS[0].region,
    curatorName: AGENTS[0].curator,
    topic: 'Не проходит котировка по ОСАГО',
    assignee: null,
    live: false,
    messages: [
      {
        id: 'm1',
        at: agoIso(38),
        author: 'agent',
        authorName: AGENTS[0].name,
        text: 'Здравствуйте! По ВАЗ 2114 не считается ОСАГО ни в одной компании, пишет «нет предложений». Клиент рядом стоит.',
      },
    ],
  },
  {
    id: 'thread-polezhaev',
    agentName: AGENTS[3].name,
    agentIkp: AGENTS[3].ikp,
    agentPhone: AGENTS[3].phone,
    region: AGENTS[3].region,
    curatorName: AGENTS[3].curator,
    topic: 'Оплата прошла, полис не пришёл',
    assignee: OPERATOR,
    live: false,
    messages: [
      {
        id: 'm1',
        at: agoIso(3 * 60),
        author: 'agent',
        authorName: AGENTS[3].name,
        text: 'Клиент оплатил картой, деньги списались, а полиса в договорах нет.',
      },
      {
        id: 'm2',
        at: agoIso(2 * 60 + 40),
        author: 'support',
        authorName: SUPPORT_NAME,
        text: 'Проверяю платёж. Пришлите, пожалуйста, номер расчёта или последние 4 цифры карты.',
      },
      {
        id: 'm3',
        at: agoIso(2 * 60 + 10),
        author: 'agent',
        authorName: AGENTS[3].name,
        text: 'Расчёт 4417, карта ...8842.',
      },
    ],
  },
  {
    id: 'thread-kyzhinaeva',
    agentName: AGENTS[2].name,
    agentIkp: AGENTS[2].ikp,
    agentPhone: AGENTS[2].phone,
    region: AGENTS[2].region,
    curatorName: AGENTS[2].curator,
    topic: 'Когда придёт комиссия за январь',
    assignee: null,
    live: false,
    escalatedTo: undefined,
    messages: [
      {
        id: 'm1',
        at: agoIso(6 * 60),
        author: 'agent',
        authorName: AGENTS[2].name,
        text: 'Добрый день! Подскажите, выплата за январь когда будет? В «Моих финансах» висит «в обработке».',
      },
    ],
  },
];

// ─── Мутации (кокпит работает по этим же объектам) ───────────────────────────

export function findSupportRequest(id: string): SupportRequestDetail | undefined {
  return supportRequests.find((r) => r.id === id);
}

export function findSupportThread(id: string): SupportChatThread | undefined {
  return supportThreads.find((t) => t.id === id);
}

export function pushThreadReply(
  id: string,
  text: string,
  author: string,
): SupportChatThread | undefined {
  const thread = findSupportThread(id);
  if (!thread) return undefined;
  thread.messages.push({
    id: faker.string.uuid(),
    at: new Date().toISOString(),
    author: 'support',
    authorName: author,
    text,
  });
  return thread;
}
