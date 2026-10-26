import { dayMasterFromDate } from './social-tags.mjs?v=20261026-social-tags-45';

// Product-authored landing copy. Selection shares the card's civil-date day
// master calculation; this is not a new chart, timezone, or personality model.
const reading = (dayMaster, family, companion, paragraphs) => Object.freeze({
  matched: true,
  stem: dayMaster[0],
  dayMaster,
  title: `${dayMaster} · ${family}`,
  companion,
  paragraphs: Object.freeze(paragraphs),
});

export const LANDING_DAY_MASTER_READINGS = Object.freeze({
  甲木: reading('甲木', '大樹系', 'Spri', [
    '你是如同大樹一般的木系，和我一樣～你正直可靠，說到做到，有些時候會有一點小固執。你總是習慣把事情安排好，身邊的人遇到事也會習慣性的去詢問你的意見。一個小小的約定、一件共同完成的事，都會讓你覺得身邊多了一個可以並肩的人。',
    'Spri想告訴你，雖然你看起來很能扛，但是需要被理解的時候Spriggi會一直在這裡。',
  ]),
  乙木: reading('乙木', '藤蔓系', 'Spri', [
    '你是如同藤蔓一般的木系，和我一樣～你溫柔靈活，懂得變通。你很會照顧別人的感受，有些時候甚至會忽略掉自己。雖然你看起來軟軟的，但是其實內心很堅韌。',
    'Spri 想告訴你，如果你總是下意識地先照顧對方的想法，也可以說一句：「其實，我更喜歡這樣。」 Spri會永遠支持你的決定。',
  ]),
  丙火: reading('丙火', '太陽系', 'Flar', [
    '你是如同太陽一般的火系，和我一樣～熱情爽朗，大大方方。像人群中的小太陽，照亮周圍的人。接受不了冷場，總是熱熱鬧鬧的，但是回到家又會變得很安靜。',
    'Flar想和你說，不用一直做別人的小太陽，如果發光累了就歇歇，讓Flar來做你的小太陽！',
  ]),
  丁火: reading('丁火', '燭火系', 'Flar', [
    '你是如同燭火一般的火系，和我一樣～你溫暖細膩，心裡藏著不少浪漫的小心思。你會記住別人隨口說過的話，也會被對方的真誠所打動。',
    'Flar想和你說，有心事的時候，不用等整理好了再開口。哪怕只是說一句「我想找你聊聊」，Flar也會認真聽你慢慢講～',
  ]),
  戊土: reading('戊土', '山巒系', 'Terr', [
    '你是如同山巒一般的土系，和我一樣～你沉穩可靠，答應的事情會放在心上，讓身邊的人很有安全感。你不會一下子就和別人熟絡起來，往往需要一段時間的陪伴與觀察。大家習慣於依靠你，常常會忘了你也會有拿不準的時候。',
    'Terr想和你說，不用每次都立馬找到解決方法。還沒想好也沒關係，Terr陪你一起想，你也可以放心依靠一下別人。',
  ]),
  己土: reading('己土', '沃土系', 'Terr', [
    '你是如同沃土一般的土系，和我一樣～你細緻耐心，很會照顧別人。一起吃飯時記得別人的口味，發現誰需要幫忙就順手搭一把，你的關心常常藏在這些日常的小事裡。但是很多時候，都會把自己的需求放到最後。',
    'Terr想問問你，今天的你想吃什麼，又想做些什麼呢？你的心意也值得被放在心上，這次，讓Terr先來關心你。',
  ]),
  庚金: reading('庚金', '金石系', 'Klin', [
    '你是如同金石一般的金系，和我一樣～你坦誠果斷，很講義氣。認定了一個人，遇到事情就願意站出來，陪對方一起扛。你不太喜歡繞彎子，關心也常常直接變成行動。',
    'Klin想和你說，輪到你遇上難處時，也記得告訴我，Klin會一直站在你的身旁！',
  ]),
  辛金: reading('辛金', '珠玉系', 'Klin', [
    '你是如同珠玉一般的金系，和我一樣～你精緻敏銳，有自己的審美，也很在意相處時的分寸。別人記得你的偏好、認真對待你的感受，都會讓你願意再靠近一點。',
    'Klin想和你說，如果有什麼讓你不舒服，不用勉強自己說「沒關係」。在Klin面前，你的感受值得被認真聽見。',
  ]),
  壬水: reading('壬水', '江海系', 'Pluppi', [
    '你是如同江海一般的水系，和我一樣～你自由聰慧，對新鮮事充滿好奇。一個有趣的想法，就能讓你和人聊上很久。新的風景、新的經歷，也總讓你想去看看。',
    'Pluppi想和你說，你想出發的時候，Pluppi陪你看看世界！想歇一歇的時候，我們就安靜待一會兒～',
  ]),
  癸水: reading('癸水', '雨露系', 'Pluppi', [
    '你是如同癸水一般的水系，和我一樣～你敏銳細膩，心裡有很多豐富的想法。你能細心察覺到別人的語氣和情緒，有時候一句不經意的話，也會讓你在心裡想上很久，猜著對方到底是什麼意思。',
    'Pluppi想和你說，拿不準的時候可以問一問，不用把所有疑惑留給自己，Pluppi會認真傾聽～',
  ]),
});

const UNKNOWN_READING = Object.freeze({
  matched: false,
  stem: '',
  dayMaster: '',
  title: '慢慢認識你',
  companion: '',
  paragraphs: Object.freeze([
    '還沒有完整的出生日期，我們可以先從你的故事開始，慢慢認識彼此。',
    '等你準備好了，再告訴我你的生日吧。',
  ]),
});

export function getLandingReading(dateOrAnswers) {
  const date = typeof dateOrAnswers === 'string' ? dateOrAnswers : dateOrAnswers?.birthDate;
  const dayMaster = typeof date === 'string' ? dayMasterFromDate(date) : '';
  return LANDING_DAY_MASTER_READINGS[dayMaster] || UNKNOWN_READING;
}
