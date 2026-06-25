// Команда агента — сотрудники и субагенты (демо-данные прототипа).
// Состав детерминированный (не faker), чтобы демо было стабильным и узнаваемым
// и повторяло карточку агента из 1С (вкладка «Дополнительная информация»).

export interface TeamEmployeeFixture {
  id: string;
  ikp: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  category: string;
  policiesPerMonth: number;
  address: string;
}

export interface TeamSubagentFixture {
  id: string;
  ikp: string;
  fullName: string;
  phone: string;
}

export interface AgentTeamFixture {
  worksWithoutEmployees: boolean;
  employees: TeamEmployeeFixture[];
  worksWithoutSubagents: boolean;
  subagents: TeamSubagentFixture[];
}

export const agentTeam: AgentTeamFixture = {
  worksWithoutEmployees: false,
  employees: [
    {
      id: 'emp-404',
      ikp: '00404',
      fullName: 'Какоурова Анжелика Александровна',
      phone: '+79526298853',
      email: 'kakourova77@mail.ru',
      role: 'Оформление полисов',
      category: 'Категория 2',
      policiesPerMonth: 42,
      address: '669120, Иркутская обл, Баяндаевский р-н, с. Баяндай',
    },
    {
      id: 'emp-530',
      ikp: '00530',
      fullName: 'Хунгуреева Арюна Константиновна',
      phone: '+79041107734',
      email: 'centrstrahovania@inbox.ru',
      role: 'Оформление полисов',
      category: 'Категория 4',
      policiesPerMonth: 28,
      address: '669000, Иркутская обл, Эхирит-Булагатский р-н, п. Усть-Ордынский',
    },
  ],
  // Демонстрируем и пустое состояние — «работает без субагентов».
  worksWithoutSubagents: true,
  subagents: [],
};
