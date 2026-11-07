/**
 * ⚠️ 示範資料（mock）。正式上線前由政策內容人員 A、視覺素材人員 B 替換並驗證。
 * sourceUrl 暫時指向各主管機關首頁，需換成具體政策頁並由後端檢查可用性。
 * 背景：Unsplash 照片（public/data/backgrounds.json），見 src/data/backgrounds.ts。
 */
export const MOCK_USERS = [
  { id: 1, account: 'user-a', displayName: '小明', createdAt: '2026-11-01T02:00:00Z' },
  { id: 2, account: 'user-b', displayName: '秀英阿姨', createdAt: '2026-11-02T02:00:00Z' },
  { id: 3, account: 'user-c', displayName: '阿忠伯', createdAt: '2026-11-03T02:00:00Z' },
]

export const MOCK_POLICIES = [
  {
    id: 1,
    category: '社會福利',
    title: '敬老愛心卡',
    slogan: '敬老卡帶身上\n搭車出門走走\n身體好心情好',
    sourceUrl: 'https://dosw.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 2,
    category: '社會福利',
    title: '長照服務專線',
    slogan: '照顧家人不孤單\n長照服務打1966',
    sourceUrl: 'https://1966.gov.tw/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 3,
    category: '交通安全',
    title: '車輛停讓行人',
    slogan: '轉彎停讓行人\n禮讓是美德\n平安回家最重要',
    sourceUrl: 'https://dot.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 4,
    category: '交通安全',
    title: '長者安全過馬路',
    slogan: '過馬路走斑馬線\n看清號誌慢慢走',
    sourceUrl: 'https://dot.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 5,
    category: '防詐騙',
    title: '165 反詐騙',
    slogan: '接到可疑電話\n先掛斷再查證\n撥打165',
    sourceUrl: 'https://165.npa.gov.tw/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 6,
    category: '醫療保健',
    title: '秋冬接種流感疫苗',
    slogan: '秋冬打疫苗\n健康過好年',
    sourceUrl: 'https://health.gov.taipei/',
    startDate: '2026-10-01',
    endDate: '2027-03-31',
    isActive: true,
  },
  {
    id: 7,
    category: '醫療保健',
    title: '長者健康檢查',
    slogan: '每年健康檢查\n早發現早安心',
    sourceUrl: 'https://health.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 8,
    category: '環境保護',
    title: '循環杯租借',
    slogan: '出門借個循環杯\n少用一次性\n台北更美麗',
    sourceUrl: 'https://www.dep.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 9,
    category: '環境保護',
    title: '垃圾分類資源回收',
    slogan: '垃圾不落地\n資源要回收',
    sourceUrl: 'https://www.dep.gov.taipei/',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    // 已過期：不應出現在清單與隨機結果
    id: 10,
    category: '醫療保健',
    title: '（已結束）夏季防中暑',
    slogan: '天氣熱多喝水',
    sourceUrl: 'https://health.gov.taipei/',
    startDate: '2026-06-01',
    endDate: '2026-09-30',
    isActive: true,
  },
]

/** 首次開啟時預先產生的示範作品 */
export const MOCK_SEED_ARTWORKS = [
  { ownerId: 2, backgroundId: 4, policyId: 6, greeting: '早安', greetingStyle: 'red-orange', sloganStyle: 'gold-blue', likes: 42, downloads: 18, ago: 5 },
  { ownerId: 3, backgroundId: 3, policyId: 5, greeting: '平安喜樂', greetingStyle: 'gold-red', sloganStyle: 'white-black', likes: 25, downloads: 61, ago: 4 },
  { ownerId: 2, backgroundId: 1, policyId: 1, greeting: '午安', greetingStyle: 'blue-glow', sloganStyle: 'pink-white', likes: 25, downloads: 9, ago: 3 },
  { ownerId: 3, backgroundId: 8, policyId: 8, greeting: '天天開心', greetingStyle: 'rainbow', sloganStyle: 'green-white', likes: 12, downloads: 25, ago: 2 },
  { ownerId: 2, backgroundId: 5, policyId: 3, greeting: '晚安', greetingStyle: 'gold-blue', sloganStyle: 'blue-glow', likes: 7, downloads: 3, ago: 1 },
]
