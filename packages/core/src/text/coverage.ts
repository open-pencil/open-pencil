import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import type { FontFallbackScript } from '#core/text/fallbacks'
import { weightToStyle } from '#core/text/fonts'
import { fontGlyphCoverageSync } from '#core/text/opentype'

const CJK_IDEOGRAPH_CHAR_RE = /[\u3400-\u9fff\uf900-\ufaff]/u
const CJK_HIRAGANA_KATAKANA_RE = /[\u3040-\u30ff]/u
const CJK_HANGUL_RE = /[\uac00-\ud7af]/u
const CJK_CHAR_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/u
const ARABIC_CHAR_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u

// Common Traditional-only characters. This is a heuristic for fallback order, not language ID.
const TRADITIONAL_CJK_CHAR_RE =
  /[萬與專業叢東絲丟兩嚴喪個豐臨為麗舉麼義烏樂喬習鄉書買亂爭於虧雲亞產畝親褻褸億僅從侖倉儀們價眾優會傘偉傳傷倫偽體餘傭僉俠侶僥偵側僑儈儕儂億儉儐儔儕償儘兒兌黨蘭關興茲養獸內岡冊寫軍農冪凍淨準涼減湊凜幾鳳凱別刪剛創劃劉則剎剗剛劑剮劍劇勸辦務動勵勁勞勢勛勝匯匱區協華單賣盧衛卻卽廠廳歷厲壓厭厙厠廈廚廄縣參雙發變敘葉號嘆嘍嘔嘖嘗嘜嘩嘮嘯嘰囑圍園圓圖團聖場壞塊堅壇壩壯聲殼壺處備複夠頭夾奪奮奧婦媽妝姍姦娛婁婦嬰孫學孿宮寬賓寢實寧審寫寶將專尋導壽對爾塵嘗堯尷屆屍屜屢層屨歲歸當錄彥徹徑從復恥悅悵悶惡惱惲愛愜愷態慘慚慟慣慪慫慮慳慶憂憊憐憑憒憚憤憫憮憲憶懇應懶懷懸懺懼懾戀戇戔戧戰戲戶拋挾捨捫掃掄掗掙掛採揀揚換揮損搖搗搶摑摜摟摯摳摶摻撈撐撓撚撝撟撣撥撫撲撳撻撾撿擁擄擇擊擋擠擡擬擯擰擱擲擴擺擾攏攔攖攙攜攝攢敵斂斃斕斬斷於時晉晝暈暉暘暢暫曄曆曇曉曏曖曠曨會朧東棟棧棲樣欄樹樺橋機橢橫檔檢樓標樞樞樂樅歐殲殮毆氣氫氬氳決況洶浹涇涼淒淚淥淵淶淺漁漚漢滿滯滲滷滸滻滾滿漬漸漿潁潑潔潛潤潯潰潷潿澀澆澇澗澠澤澦澩澮濁濃濕濟濤濫濰濱濺濾瀆瀉瀋瀏瀕瀘瀝瀟瀠瀦瀧瀨瀰瀲灑灘灝灣灤災為烏無煉煒煙煩煬熱熾燁燈燒燙燜營燦燭爍爐爛爭爺牆牘犧狀獨狹獅獎獄獵獸獻獺璣瑪瑋環現琺琿瑤瑩瑪璉璦璫璽瓊瓏瓔甌產畝畢異畫當疇疊痙痾瘂瘋瘍瘞瘡瘧瘮瘲瘺瘻療癆癇癉癐癒癘癟癢癤癥癧癩癬癭癮癰癱癲發皚皺盜盞盡監盤盧眥眾睏睜睞瞘瞜瞞瞭瞼矚矯硃硤硨確碼磚磣磧磯礎礙礦礪礫礬祿禍禎禦禪禮禰禱禿秈稅稈稜稟種稱穀穌積穎穡穢穩穫窩窪窮竄竅竇竊競筆筍筧箋箏節範築篋篔篤篩簀簍簞簡簣簫簽簾籃籌籙籠籤籩籬粵糝糞糧糲糴糶糾紀紂約紅紆紇紈紉紋納紐紓純紕紗紙級紛紜紡紥細紱紲紳紹紺紿終組絆絎結絕絛絞絡給絨絰統絲絳絹綁綃綆綈綏經綜綞綠綢綣綫綬維綯綰綱網綴綵綸綹綺綻綽綾綿緄緇緊緋緑緒緓緔緗緘緙線緜緝緞締緡緣緦編緩緬緯緲練緶緹緻縈縉縊縋縐縑縗縛縝縞縟縣縧縫縭縮縱縲縳縴縵縶縷縹總績繃繅繆繈繒織繕繞繚繡繢繩繪繫繭繮繯繰繳繹繼纈纊續纍纏纓纖纘纜缽罈罌罰罵罷羅羆羈羋羥義習翬翹耬聖聞聯聰聲聳職聶聾肅脅脈脛脫脹腎腖腡腦腫腳腸膃膚膠膩膽膾膿臉臍臏臘臚臟臠臨臺與興舉舊艙艤艦艫艱艷芻苧茲荊莊莖莢莧華萇萊萬萵葉葒著葦葷蒓蒔蒞蒼蓀蓋蓮蓯蓴蓽蔔蔞蔣蔥蔦蔭蕁蕆蕎蕒蕓蕕蕘蕢蕩蕪蕭蕷薈薊薌薔薘薟薦薩薳薴薺藍藎藝藥藪蘄蘆蘇蘊蘋蘚蘞蘢蘭蘺處虛虜號虧蟲蟄蟈蟎蟣蟥蟬蟯蟲蟻蠅蠆蠍蠐蠑蠟蠣蠱蠶蠻衆術衛衝袞裊裡補裝裡製複褲褳褸襇襠襤襪襬襯襲見覎規覓視覘覡覥覦親覬覯覲覷覺覽覿觀觴觸訁訂訃計訊訌討訐訕訖託記訛訝訟訣訥訪設許訴訶診註詁詆詎詐詔評詖詗詘詛詞詠詡詢詣試詩詫詬詭詮詰話該詳詵詼詿誄誅誆誇誌認誑誒誕誘誚語誠誡誣誤誥誦誨說誰課誶誹誼誾調諂諄談諉請諍諏諑諒論諗諛諜諝諞諡諢諤諦諧諫諭諮諱諳諶諷諸諺諾謀謁謂謄謅謊謎謐謔謖謗謙謚講謝謠謨謫謬謳謹謾譁證譎譏譔譖識譙譚譜譟警譫譯議譴護譽讀變讌讎讒讓讖讚讜讞豈豎豬貓貝貞負財責賢敗賬貨質販貪貧貶購貯貫貳賁貴貶買貸費貼貽貿賀賁賂賃賄資賈賊賑賒賓賕賙賚賜賞賠賡賢賣賤賦質賬賭賴賵賺賻購賽贄贅贇贈贊贋贍贏贐贓贔贖贗贛趕趙趨趲跡踐踴蹌蹕蹣蹤蹺躂躉躊躋躍躑躒躓躕躚躥躦躪軀車軋軌軍軒軔軛軟軤軫軲軸軹軺軻軼軾較輅載輊輒輓輔輕輛輜輝輞輟輥輦輩輪輯輸輻輾輿轂轄轅輿轉轍轎轔轟轡轢轤辦辭辮辯農迴逕這連週進遊運過達違遙遞遠適遲遷選遺遼邁還邇邊邏邐郟郵鄆鄉鄒鄔鄖鄧鄭鄰鄲鄴鄶鄺酈醜醞醫醬釀釁釃釅釋釐鈔鈕鈞鈣鈧鈮鈽鈾鈿鉀鉅鉈鉉鉋鉑鈴鉍鉗鉚鉛鉞鉦鉬鉭鉸鉺鉻鉿銀銃銅銑銓銖銘銚銛銜銠銣銥銦銨銩銪銫銬銱銳銷銹銻銼鋁鋃鋅鋇鋌鋏鋒鋙鋝鋟鋣鋤鋥鋦鋨鋪鋯鋰鋱鋶鋸鋼錄錆錇錈錏錐錒錕錘錙錚錛錟錠錡錢錦錨錫錮錯錳錶鍀鍁鍃鍆鍇鍊鍍鍔鍘鍛鍠鍤鍥鍩鍬鍰鍵鍶鍾鎂鎄鎇鎊鎔鎖鎗鎘鎚鎛鎝鎡鎢鎣鎦鎧鎩鎪鎬鎮鎰鎵鎿鏃鏇鏈鏌鏍鏑鏗鏘鏜鏝鏞鏟鏡鏢鏤鏨鏰鏵鏷鏹鐃鐋鐐鐒鐓鐔鐘鐙鐝鐠鐦鐧鐨鐫鐮鐲鐳鐵鐶鐸鐺鐿鑄鑊鑌鑒鑔鑞鑠鑣鑥鑭鑰鑲鑷鑽鑾鑿長門閂閃閉開閌閎閏閑間閔閘閡閣閥閨閩閫閬閭閱閶閹閻閼閽閾閿闃闆闈闊闋闌闍闐闓闔闕闖關闞闠闡闢闥闧阜陘陝陣陰陳陸陽隉隊階隕際隨險隱隴隸隻雋雙雛雜雞離難雲電霧霽靂靄靆靈靚靜靦鞏鞦韁韃韆韉韋韌韓韙韜韞韻響頁頂頃項順須頊頌頎預頑頒頓頗領頜頡頤頦頭頰頲頸頻頼題額顎顏顒顓願顙顛類顢顥顧顫顯顰顱風颭颮颯颱颳颶颼飄飆飛飠飢飣飥飩飪飫飭飯飲飴飼飽飾餃餄餅餉養餌餎餏餑餒餓餕餘餚餛餜餞餡館餱餳餵餶餷餺餼餾餿饁饃饅饈饉饋饌饑饒饗饜饞饢馬馭馮馱馳馴駁駐駑駒駔駕駙駛駝駟駡駢駭駰駱駿騁騅騎騏騖騙騚騷騶騾驀驁驂驃驄驅驊驍驏驕驗驚驛驟驢驥驦驪驫骯髏髒體髕髖鬆鬍鬚鬥鬧鬨鬩鬮魚魯魴鮁鮃鮑鮒鮚鮞鮦鮪鮫鮭鮮鯁鯉鯊鯒鯖鯗鯛鯝鯡鯢鯤鯧鯨鯪鯫鯰鯴鯷鯽鰂鰈鰉鰍鰒鰓鰜鰟鰠鰣鰥鰨鰩鰭鰱鰲鰳鰵鰷鰹鰺鰻鰾鱈鱉鱒鱔鱖鱗鱘鱝鱟鱠鱣鱤鱧鱨鱭鱯鱷鱸鳥鳧鳩鳳鳴鳶鴆鴇鴉鴒鴕鴛鴝鴞鴟鴣鴦鴨鴯鴰鴻鴿鵂鵃鵑鵒鵓鵜鵝鵠鵡鵪鵬鵮鵯鵲鶇鶉鶓鶘鶚鶩鶯鶲鶴鶺鶻鷂鷓鷗鷙鷚鷥鷦鷫鷯鷲鷸鷹鷺鸚鸛鹵鹹鹺鹼鹽麗麥麼黃黌點黨黲黷黽鼇鼉鼴齊齋齎齏齒齔齕齙齜齟齡齠齣齦齧齪齬齲齶齷龍龐龔龕龜]/u

function scriptCharRegex(script: FontFallbackScript): RegExp {
  switch (script) {
    case 'arabic':
      return ARABIC_CHAR_RE
    case 'cjk-jp':
      return CJK_HIRAGANA_KATAKANA_RE
    case 'cjk-kr':
      return CJK_HANGUL_RE
    case 'cjk-tc':
      return TRADITIONAL_CJK_CHAR_RE
    default:
      return CJK_IDEOGRAPH_CHAR_RE
  }
}

function fallbackScriptForCJKChar(char: string): FontFallbackScript {
  if (CJK_HANGUL_RE.test(char)) return 'cjk-kr'
  if (CJK_HIRAGANA_KATAKANA_RE.test(char)) return 'cjk-jp'
  if (TRADITIONAL_CJK_CHAR_RE.test(char)) return 'cjk-tc'
  return 'cjk-sc'
}

function styleForCharacter(node: SceneNode, index: number): { family: string; style: string } {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  let family = baseFamily
  let weight = node.fontWeight
  let italic = node.italic

  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  if (run) {
    family = run.style.fontFamily ?? family
    weight = run.style.fontWeight ?? weight
    italic = run.style.italic ?? italic
  }

  return { family, style: weightToStyle(weight, italic) }
}

/**
 * Returns true only when a loaded, parseable primary font is known to miss a script glyph.
 * Unknown coverage is treated as renderable so we do not degrade fonts CanvasKit may handle.
 */
export function textNeedsFallbackScript(node: SceneNode, script: FontFallbackScript): boolean {
  if (node.type !== 'TEXT' || !node.text) return false
  const regex = scriptCharRegex(script)

  for (let index = 0; index < node.text.length; index++) {
    const char = node.text[index]
    if (!char || !regex.test(char)) continue
    const { family, style } = styleForCharacter(node, index)
    if (fontGlyphCoverageSync(family, style, char) === 'missing') return true
  }

  return false
}

export function textNeededFallbackScripts(node: SceneNode): FontFallbackScript[] {
  const scripts = new Set<FontFallbackScript>()
  if (textNeedsFallbackScript(node, 'arabic')) scripts.add('arabic')

  let missingIdeograph = false
  let missingTraditionalIdeograph = false
  for (let index = 0; index < node.text.length; index++) {
    const char = node.text[index]
    if (!char || !CJK_CHAR_RE.test(char)) continue
    const { family, style } = styleForCharacter(node, index)
    if (fontGlyphCoverageSync(family, style, char) !== 'missing') continue

    if (CJK_IDEOGRAPH_CHAR_RE.test(char)) {
      missingIdeograph = true
      if (TRADITIONAL_CJK_CHAR_RE.test(char)) missingTraditionalIdeograph = true
    } else {
      scripts.add(fallbackScriptForCJKChar(char))
    }
  }

  if (missingIdeograph) scripts.add(missingTraditionalIdeograph ? 'cjk-tc' : 'cjk-sc')

  return [...scripts]
}
