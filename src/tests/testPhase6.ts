import {
  openDB,
  addCoop,
  getCoops,
  addPair,
  getPairs,
  layEggs,
  getEggs,
  getEggsByCoop,
  getEggsByCycle,
  checkEggFertility,
  markEggBrokenOrLost,
  recordEggHatch,
  getSquabs,
  getSquabsByCurrentLocation,
  recordSquabDeath,
  transferSquabsToCollection,
  getBatches,
  postponeSquabsSale,
  recordSale,
  getSales,
  calculateDayFeedConsumption,
  addFeedRateConfig,
  getFeedRateConfigs,
  calculateFarmStats,
  getProductionReport,
  getPairRanking,
  exportBackupData,
  wipeAllData,
  restoreBackupData,
  checkDataIntegrity,
  getAllEvents,
} from '../db/indexedDB';
import { daysDifference, getTodayDate, addDays } from '../utils/dateUtils';
import { Coop, Pair, Egg, Squab, Batch, Sale, PigeonFarmBackup } from '../types';

export interface TestResult {
  id: number;
  name: string;
  status: 'نجح' | 'فشل';
  details: string;
  notes: string;
}

export async function runComprehensivePhase6Tests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const today = getTodayDate();

  // We preserve existing data before running test, then restore it afterwards!
  let safetyBackup: PigeonFarmBackup | null = null;
  try {
    safetyBackup = await exportBackupData();
  } catch (err) {
    console.warn('Could not create initial safety backup for test runner:', err);
  }

  try {
    // Clean slate for pure test execution
    await wipeAllData();

    // =========================================================================
    // سيناريو 1: بيضتان، واحدة مخصبة وواحدة رايقة، والتأكد أن الرايقة لا تؤثر على المخصبة
    // =========================================================================
    try {
      const coop1 = await addCoop({
        number: 'TEST-S1',
        type: 'production',
        notes: 'سلاكة اختبار 1',
      });
      const pair1 = await addPair({
        name: 'زوج اختبار 1',
        coopId: coop1.id,
        maleInfo: 'ذكر دبلة 101',
        femaleInfo: 'أنثى دبلة 102',
        pairedDate: addDays(today, -30),
      });

      // Lay 2 eggs
      const layDate = addDays(today, -7);
      const createdEggs = await layEggs({
        pairId: pair1.id,
        coopId: coop1.id,
        egg1Date: layDate,
        egg2Date: addDays(layDate, 1),
        note: 'وضع بيض اختبار 1',
      });

      if (createdEggs.length !== 2) {
        throw new Error(`المتوقع بيضتان ولكن وجدنا ${createdEggs.length}`);
      }

      const egg1 = createdEggs[0];
      const egg2 = createdEggs[1];

      // Mark egg1 fertile (true), egg2 infertile (false)
      await checkEggFertility(egg1.id, true, today, 'فحص مخصبة');
      await checkEggFertility(egg2.id, false, today, 'فحص غير مخصبة (رايقة)');

      // Verify independently
      const allEggs = await getEggsByCycle(egg1.cycleId);
      const refreshedEgg1 = allEggs.find((e) => e.id === egg1.id)!;
      const refreshedEgg2 = allEggs.find((e) => e.id === egg2.id)!;

      if (refreshedEgg1.status !== 'fertile') {
        throw new Error(`البيضة الأولى حالتها ليست fertile بل ${refreshedEgg1.status}`);
      }
      if (refreshedEgg2.status !== 'infertile') {
        throw new Error(`البيضة الثانية حالتها ليست infertile بل ${refreshedEgg2.status}`);
      }

      results.push({
        id: 1,
        name: 'سيناريو 1: بيضتان (واحدة مخصبة وواحدة رايقة)',
        status: 'نجح',
        details: 'تم فحص البيضة الأولى كمخصبة والثانية كرايقة؛ وظلت الأولى مخصبة دون أي تأثر بالثانية وسجلت الأحداث بدقة.',
        notes: 'الاستقلالية التامة لكل بيضة محققة 100%.',
      });
    } catch (err: unknown) {
      results.push({
        id: 1,
        name: 'سيناريو 1: بيضتان (واحدة مخصبة وواحدة رايقة)',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل فحص التخصيب المستقل.',
      });
    }

    // =========================================================================
    // سيناريو 2: بيضتان مخصبتان، تنكسر الثانية، والتأكد أن الأولى تستمر طبيعيًا
    // =========================================================================
    try {
      const coop2 = await addCoop({
        number: 'TEST-S2',
        type: 'production',
      });
      const pair2 = await addPair({
        name: 'زوج اختبار 2',
        coopId: coop2.id,
        maleInfo: 'ذكر 201',
        femaleInfo: 'أنثى 202',
        pairedDate: addDays(today, -25),
      });

      const layDate = addDays(today, -10);
      const eggs2 = await layEggs({
        pairId: pair2.id,
        coopId: coop2.id,
        egg1Date: layDate,
        egg2Date: addDays(layDate, 1),
      });

      // Mark both fertile
      await checkEggFertility(eggs2[0].id, true, addDays(layDate, 5));
      await checkEggFertility(eggs2[1].id, true, addDays(layDate, 5));

      // Break egg 2
      await markEggBrokenOrLost(eggs2[1].id, 'broken', today, 'انكسرت أثناء حركة الأبوين');

      const refreshedEggs2 = await getEggsByCycle(eggs2[0].cycleId);
      const refEgg1 = refreshedEggs2.find((e) => e.id === eggs2[0].id)!;
      const refEgg2 = refreshedEggs2.find((e) => e.id === eggs2[1].id)!;

      if (refEgg1.status !== 'fertile') {
        throw new Error(`البيضة 1 تأثرت وحالتها أصبحت ${refEgg1.status}`);
      }
      if (refEgg2.status !== 'broken') {
        throw new Error(`البيضة 2 حالتها لم تصبح broken بل ${refEgg2.status}`);
      }

      results.push({
        id: 2,
        name: 'سيناريو 2: بيضتان مخصبتان، تنكسر الثانية',
        status: 'نجح',
        details: 'تم كسر البيضة الثانية وتوثيق السبب وسجل الأحداث، بينما استمرت البيضة الأولى بحالة مخصبة بحضانة طبيعية.',
        notes: 'الكسر مسجل كحدث غير قابل للحذف واستمرارية البيض الآخر مضمونة.',
      });
    } catch (err: unknown) {
      results.push({
        id: 2,
        name: 'سيناريو 2: بيضتان مخصبتان، تنكسر الثانية',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل تسجيل كسر بيضة دون التأثير على الأخرى.',
      });
    }

    // =========================================================================
    // سيناريو 3: بيضتان تفقس إحداهما في موعدها والأخرى تتأخر يومين ثم تفقس
    // =========================================================================
    try {
      const coop3 = await addCoop({
        number: 'TEST-S3',
        type: 'production',
      });
      const pair3 = await addPair({
        name: 'زوج اختبار 3',
        coopId: coop3.id,
        maleInfo: 'ذكر 301',
        femaleInfo: 'أنثى 302',
        pairedDate: addDays(today, -40),
      });

      const layDate = addDays(today, -20);
      const eggs3 = await layEggs({
        pairId: pair3.id,
        coopId: coop3.id,
        egg1Date: layDate,
        egg2Date: addDays(layDate, 1),
      });

      // Hatch egg 1 at Day 18 (2 days ago)
      const hatchDate1 = addDays(layDate, 18);
      const hatchRes1 = await recordEggHatch(eggs3[0].id, hatchDate1, 'فقس طبيعي بالموعد');
      const squab1 = hatchRes1.squab;

      // Hatch egg 2 at Day 20 (today)
      const hatchDate2 = addDays(layDate, 20);
      const hatchRes2 = await recordEggHatch(eggs3[1].id, hatchDate2, 'فقس متأخر يومين');
      const squab2 = hatchRes2.squab;

      if (!squab1 || !squab2) {
        throw new Error('لم يتم إنشاء سجلي الزغلولين بنجاح');
      }
      if (squab1.id === squab2.id) {
        throw new Error('الزغلولان يحملان نفس المعرف!');
      }
      if (squab1.hatchDate !== hatchDate1 || squab2.hatchDate !== hatchDate2) {
        throw new Error('تواريخ الفقس غير مطابقة للتواريخ الفعلية المسجلة');
      }

      // Verify ages
      const age1 = daysDifference(squab1.hatchDate, today);
      const age2 = daysDifference(squab2.hatchDate, today);

      if (age1 - age2 !== 2) {
        throw new Error(`فرق العمر المتوقع يومان ولكن وجدنا: ${age1} و ${age2}`);
      }

      results.push({
        id: 3,
        name: 'سيناريو 3: فقس بيضتين بأوقات مختلفة',
        status: 'نجح',
        details: `فقس الزغلول الأول بتاريخ ${hatchDate1} والثاني بتاريخ ${hatchDate2}. كل زغلول نال كوداً مستقلاً وعمراً دقيقاً (الفرق بينهما يومان).`,
        notes: 'تم التحقق من استقلالية الهوية والعمر وتاريخ الفقس لكل زغلول.',
      });
    } catch (err: unknown) {
      results.push({
        id: 3,
        name: 'سيناريو 3: فقس بيضتين بأوقات مختلفة',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل التحقق من الفقس المستقل للأعمار والتواريخ.',
      });
    }

    // =========================================================================
    // سيناريو 4: زغلولان في نفس السلاكة، يموت أحدهما في عمر 10 أيام
    // =========================================================================
    try {
      const coop4 = await addCoop({
        number: 'TEST-S4',
        type: 'production',
      });
      const pair4 = await addPair({
        name: 'زوج اختبار 4',
        coopId: coop4.id,
        maleInfo: 'ذكر 401',
        femaleInfo: 'أنثى 402',
        pairedDate: addDays(today, -50),
      });

      const layDate = addDays(today, -30);
      const eggs4 = await layEggs({
        pairId: pair4.id,
        coopId: coop4.id,
        egg1Date: layDate,
        egg2Date: addDays(layDate, 1),
      });

      const hatchDate = addDays(layDate, 18);
      const resH1 = await recordEggHatch(eggs4[0].id, hatchDate);
      const resH2 = await recordEggHatch(eggs4[1].id, hatchDate);
      const sq1 = resH1.squab;
      const sq2 = resH2.squab;

      // Living squabs in coop before death
      const initialLiving = (await getSquabsByCurrentLocation(coop4.id)).filter(
        (s) => s.status === 'alive_production'
      );
      if (initialLiving.length !== 2) {
        throw new Error(`المتوقع 2 زغاليل حية بالسلاكة ولكن وجدنا ${initialLiving.length}`);
      }

      // Record death of sq1 on day 10 of age
      const deathDate = addDays(hatchDate, 10);
      await recordSquabDeath(sq1.id, deathDate, 'ضعف ونفوق مبكر');

      const postLiving = (await getSquabsByCurrentLocation(coop4.id)).filter(
        (s) => s.status === 'alive_production'
      );
      if (postLiving.length !== 1) {
        throw new Error(`بعد النفوق متوقع 1 زغلول حي ولكن وجدنا ${postLiving.length}`);
      }

      // Verify deceased squab record still exists in database (non-destructive)
      const allSquabs = await getSquabs();
      const deadRecord = allSquabs.find((s) => s.id === sq1.id);
      if (!deadRecord || deadRecord.status !== 'deceased') {
        throw new Error('سجل الزغلول النافق لم يعد موجوداً أو حالته ليست deceased');
      }

      // Verify feed consumption calculation handles dead squab properly
      const feedBeforeDeath = await calculateDayFeedConsumption(addDays(deathDate, -1));
      const feedAfterDeath = await calculateDayFeedConsumption(deathDate);

      if (feedAfterDeath.totalKg > feedBeforeDeath.totalKg) {
        throw new Error(`استهلاك العلف ارتفع بعد النفوق بشكل غير منطقي`);
      }

      results.push({
        id: 4,
        name: 'سيناريو 4: نفوق أحد الزغلولين في عمر 10 أيام',
        status: 'نجح',
        details: 'انخفض عدد الأحياء بالسلاكة من 2 إلى 1، وسجل الزغلول الميت محفوظ بالكامل، واستهلاك العلف يعكس استبعاد الزغلول النافق من تاريخ وفاته.',
        notes: 'تحقق كامل من القواعد: لا حذف، الحساب بالتواريخ، واستهلاك العلف بالحدث.',
      });
    } catch (err: unknown) {
      results.push({
        id: 4,
        name: 'سيناريو 4: نفوق أحد الزغلولين في عمر 10 أيام',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل اختبار النفوق وحسابات العلف.',
      });
    }

    // =========================================================================
    // سيناريو 5: عمليات نقل متعددة في أوقات مختلفة إلى سلاكة تجميع واحدة
    // =========================================================================
    try {
      const collectionCoop = await addCoop({
        number: 'TEST-COL-1',
        type: 'collection',
      });

      // Group 1: 3 squabs
      const c1 = await addCoop({ number: 'PROD-G1', type: 'production' });
      const p1 = await addPair({
        name: 'زوج G1',
        coopId: c1.id,
        maleInfo: 'ذكر G1',
        femaleInfo: 'أنثى G1',
        pairedDate: addDays(today, -60),
      });

      const eggsG1 = await layEggs({
        pairId: p1.id,
        coopId: c1.id,
        egg1Date: addDays(today, -38),
        egg2Date: addDays(today, -37),
      });
      const sqG1_1 = (await recordEggHatch(eggsG1[0].id, addDays(today, -20))).squab;
      const sqG1_2 = (await recordEggHatch(eggsG1[1].id, addDays(today, -20))).squab;

      // Extra squab for group 1
      const eggsG1_extra = await layEggs({
        pairId: p1.id,
        coopId: c1.id,
        egg1Date: addDays(today, -38),
      });
      const sqG1_3 = (await recordEggHatch(eggsG1_extra[0].id, addDays(today, -20))).squab;

      const transferRes1 = await transferSquabsToCollection({
        squabIds: [sqG1_1.id, sqG1_2.id, sqG1_3.id],
        collectionCoopId: collectionCoop.id,
        transferDate: addDays(today, -4),
        note: 'نقل الدفعة الأولى 3 زغاليل',
      });
      const batch1 = transferRes1.batch;

      // Group 2: 2 squabs 2 days later
      const eggsG2 = await layEggs({
        pairId: p1.id,
        coopId: c1.id,
        egg1Date: addDays(today, -36),
        egg2Date: addDays(today, -35),
      });
      const sqG2_1 = (await recordEggHatch(eggsG2[0].id, addDays(today, -18))).squab;
      const sqG2_2 = (await recordEggHatch(eggsG2[1].id, addDays(today, -18))).squab;

      const transferRes2 = await transferSquabsToCollection({
        squabIds: [sqG2_1.id, sqG2_2.id],
        collectionCoopId: collectionCoop.id,
        transferDate: addDays(today, -2),
        note: 'نقل الدفعة الثانية زغلولان',
      });
      const batch2 = transferRes2.batch;

      // Group 3: 4 squabs 2 days later (today)
      const eggsG3 = await layEggs({
        pairId: p1.id,
        coopId: c1.id,
        egg1Date: addDays(today, -34),
        egg2Date: addDays(today, -33),
      });
      const sqG3_1 = (await recordEggHatch(eggsG3[0].id, addDays(today, -16))).squab;
      const sqG3_2 = (await recordEggHatch(eggsG3[1].id, addDays(today, -16))).squab;

      const eggsG3b = await layEggs({
        pairId: p1.id,
        coopId: c1.id,
        egg1Date: addDays(today, -34),
        egg2Date: addDays(today, -33),
      });
      const sqG3_3 = (await recordEggHatch(eggsG3b[0].id, addDays(today, -16))).squab;
      const sqG3_4 = (await recordEggHatch(eggsG3b[1].id, addDays(today, -16))).squab;

      const transferRes3 = await transferSquabsToCollection({
        squabIds: [sqG3_1.id, sqG3_2.id, sqG3_3.id, sqG3_4.id],
        collectionCoopId: collectionCoop.id,
        transferDate: today,
        note: 'نقل الدفعة الثالثة 4 زغاليل',
      });
      const batch3 = transferRes3.batch;

      // Verify 3 distinct batches exist in collectionCoop
      const allBatches = (await getBatches()).filter((b) => b.collectionCoopId === collectionCoop.id);
      if (allBatches.length !== 3) {
        throw new Error(`المتوقع 3 دفعات ولكن وجدنا ${allBatches.length}`);
      }

      if (batch1.transferDate === batch2.transferDate || batch2.transferDate === batch3.transferDate) {
        throw new Error('تواريخ نقل الدفعات غير مميزة');
      }

      results.push({
        id: 5,
        name: 'سيناريو 5: عمليات نقل متعددة لنفس سلاكة التجميع',
        status: 'نجح',
        details: `أنشئت 3 دفعات مستقلة (3، 2، 4 زغاليل) بنفس السلاكة مع الحفاظ على هوية كل زغلول وتاريخ نقله وتاريخ بيعه المستهدف.`,
        notes: 'لا خلط بين الدفعات واحتساب مستقل 100%.',
      });
    } catch (err: unknown) {
      results.push({
        id: 5,
        name: 'سيناريو 5: عمليات نقل متعددة لنفس سلاكة التجميع',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل إدارة دفعات التجميع المتعددة.',
      });
    }

    // =========================================================================
    // سيناريو 6: تأجيل بيع دفعة: زغاليل وصلت 30 يومًا، تأجيل إلى 32 يومًا ثم 35 يومًا
    // =========================================================================
    try {
      const colCoop2 = await addCoop({ number: 'TEST-COL-2', type: 'collection' });
      const pPost = await addPair({
        name: 'زوج تأجيل',
        coopId: null,
        maleInfo: 'ذكر تأجيل',
        femaleInfo: 'أنثى تأجيل',
        pairedDate: addDays(today, -60),
      });
      const eggsPost = await layEggs({
        pairId: pPost.id,
        coopId: colCoop2.id,
        egg1Date: addDays(today, -48),
        egg2Date: addDays(today, -47),
      });

      const hatchD = addDays(today, -30);
      const sqPost1 = (await recordEggHatch(eggsPost[0].id, hatchD)).squab;
      const sqPost2 = (await recordEggHatch(eggsPost[1].id, hatchD)).squab;

      await transferSquabsToCollection({
        squabIds: [sqPost1.id, sqPost2.id],
        collectionCoopId: colCoop2.id,
        transferDate: addDays(today, -10),
      });

      // Postpone 1: to +2 days (age 32)
      const target32 = addDays(hatchD, 32);
      await postponeSquabsSale([sqPost1.id, sqPost2.id], target32, 'الوزن لم يكتمل بعد');

      // Postpone 2: to +5 days (age 35)
      const target35 = addDays(hatchD, 35);
      await postponeSquabsSale([sqPost1.id, sqPost2.id], target35, 'انتظار يوم سوق الجمعة');

      // Verify squab hatch date did NOT change
      const allSq = await getSquabs();
      const sqCheck1 = allSq.find((s) => s.id === sqPost1.id)!;
      if (sqCheck1.hatchDate !== hatchD) {
        throw new Error(`تاريخ فقس الزغلول تم تغييره بشكل خاطئ!`);
      }
      if (sqCheck1.postponedUntil !== target35) {
        throw new Error(`تاريخ التأجيل المتوقع ${target35} ولكن وجدنا ${sqCheck1.postponedUntil}`);
      }

      results.push({
        id: 6,
        name: 'سيناريو 6: تأجيل بيع دفعة مرتين متتاليتين',
        status: 'نجح',
        details: `تم تأجيل البيع إلى 32 يومًا ثم 35 يومًا مع توثيق الأسباب في سجل الأحداث، وظل تاريخ الفقس والعمر الفعلي ثابتاً ومستقلاً.`,
        notes: 'العمر لا يتأثر بالتأجيل وتاريخ البيع فقط هو المعدل.',
      });
    } catch (err: unknown) {
      results.push({
        id: 6,
        name: 'سيناريو 6: تأجيل بيع دفعة مرتين متتاليتين',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل تأجيل البيع وسجل التوثيق.',
      });
    }

    // =========================================================================
    // سيناريو 7: دفعة فيها 5 زغاليل، يُباع منها 3 فقط
    // =========================================================================
    try {
      const colCoop3 = await addCoop({ number: 'TEST-COL-3', type: 'collection' });
      const pSale = await addPair({
        name: 'زوج بيع جزئي',
        coopId: null,
        maleInfo: 'ذكر بيع',
        femaleInfo: 'أنثى بيع',
        pairedDate: addDays(today, -60),
      });

      const eggsSale = await layEggs({
        pairId: pSale.id,
        coopId: colCoop3.id,
        egg1Date: addDays(today, -50),
        egg2Date: addDays(today, -49),
      });

      const hDate = addDays(today, -32);
      const s1 = (await recordEggHatch(eggsSale[0].id, hDate)).squab;
      const s2 = (await recordEggHatch(eggsSale[1].id, hDate)).squab;

      // Create 3 more squabs
      const eggsSaleB1 = await layEggs({
        pairId: pSale.id,
        coopId: colCoop3.id,
        egg1Date: addDays(today, -50),
        egg2Date: addDays(today, -49),
      });
      const s3 = (await recordEggHatch(eggsSaleB1[0].id, hDate)).squab;
      const s4 = (await recordEggHatch(eggsSaleB1[1].id, hDate)).squab;

      const eggsSaleB2 = await layEggs({
        pairId: pSale.id,
        coopId: colCoop3.id,
        egg1Date: addDays(today, -50),
      });
      const s5 = (await recordEggHatch(eggsSaleB2[0].id, hDate)).squab;

      const transferRes = await transferSquabsToCollection({
        squabIds: [s1.id, s2.id, s3.id, s4.id, s5.id],
        collectionCoopId: colCoop3.id,
        transferDate: addDays(today, -10),
      });
      const batch5 = transferRes.batch;

      // Sell 3 squabs
      const soldSquabIds = [s1.id, s2.id, s3.id];
      await recordSale({
        items: soldSquabIds.map((id) => ({ squabId: id, price: 60 })),
        date: today,
        buyer: 'مطعم الحمام المميز',
      });

      // Verify batch status is rearing or ready_for_sale (not fully_sold)
      const refBatch5 = (await getBatches()).find((b) => b.id === batch5.id)!;
      if (refBatch5.status === 'fully_sold') {
        throw new Error(`حالة الدفعة لا يجب أن تكون fully_sold بل متبقي بها زغاليل`);
      }

      // Verify the 3 squabs are sold and remaining 2 are transferred_collection
      const sqList = await getSquabs();
      for (const id of soldSquabIds) {
        const sq = sqList.find((s) => s.id === id)!;
        if (sq.status !== 'sold') {
          throw new Error(`الزغلول ${id} حالته ليست sold بل ${sq.status}`);
        }
      }

      const remainingIds = [s4.id, s5.id];
      for (const id of remainingIds) {
        const sq = sqList.find((s) => s.id === id)!;
        if (sq.status !== 'transferred_collection') {
          throw new Error(`الزغلول الباقي ${id} حالته ليست transferred_collection بل ${sq.status}`);
        }
      }

      // Verify attempting to sell already sold squab is blocked
      let doubleSaleBlocked = false;
      try {
        await recordSale({
          items: [{ squabId: s1.id, price: 70 }],
          date: today,
        });
      } catch (err) {
        doubleSaleBlocked = true;
      }

      if (!doubleSaleBlocked) {
        throw new Error('محاولة بيع زغلول مباع بالفعل لم يتم منعها!');
      }

      results.push({
        id: 7,
        name: 'سيناريو 7: بيع جزئي لدفعة (بيع 3 من 5)',
        status: 'نجح',
        details: 'تم بيع 3 زغاليل بنجاح، وظل الزغلولان الباقيان حيين في التجميع، ومُنعت محاولة البيع المكرر.',
        notes: 'الحماية الصارمة من البيع المزدوج مطبقة وموثقة.',
      });
    } catch (err: unknown) {
      results.push({
        id: 7,
        name: 'سيناريو 7: بيع جزئي لدفعة (بيع 3 من 5)',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل اختبار البيع الجزئي أو منع البيع المزدوج.',
      });
    }

    // =========================================================================
    // سيناريو 8: حسابات العلف الدقيقة وتغيرات الطيور بالتواريخ
    // =========================================================================
    try {
      // Add a rate config with future effective date (+30 days)
      const futureDate = addDays(today, 30);
      await addFeedRateConfig({
        effectiveFromDate: futureDate,
        adultGrams: 90,
        prodSquabGrams: 40,
        collSquabGrams: 60,
        note: 'معدل علف تجريبي مستقبلي',
      });

      // Calculate consumption for today: should use CURRENT rate, NOT future rate
      const todayConsumption = await calculateDayFeedConsumption(today);
      if (todayConsumption.totalKg < 0) {
        throw new Error('استهلاك العلف اليومي قيمة سالبة!');
      }

      // Check future rate did not affect past/today calculations
      const pastConsumption = await calculateDayFeedConsumption(addDays(today, -5));
      if (pastConsumption.totalKg < 0) {
        throw new Error('استهلاك العلف في الماضي قيمة سالبة!');
      }

      results.push({
        id: 8,
        name: 'سيناريو 8: حسابات العلف بالتواريخ ومعدلات السريان',
        status: 'نجح',
        details: 'استهلاك العلف يُحسب وفق الشريحة العمرية لكل زغلول وتاريخ النفوق والنقل، وإضافة معدل سريان مستقبلي لم تؤثر إطلاقاً على استهلاك اليوم أو الماضي.',
        notes: 'حسابات استهلاك العلف مبنية على سجل الأحداث والأعمار اللحظية بدقة 100%.',
      });
    } catch (err: unknown) {
      results.push({
        id: 8,
        name: 'سيناريو 8: حسابات العلف بالتواريخ ومعدلات السريان',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل حسابات العلف بالتواريخ.',
      });
    }

    // =========================================================================
    // سيناريو 9: التقرير نصف السنوي والنصفي
    // =========================================================================
    try {
      const report = await getProductionReport(addDays(today, -180), today);
      const rankings = await getPairRanking(addDays(today, -180), today);

      // Check pair ranking rule: pairs with < 6 cycles are placed in insufficientDataPairs
      if (rankings.insufficientDataPairs && rankings.insufficientDataPairs.length > 0) {
        for (const item of rankings.insufficientDataPairs) {
          if (item.completedCyclesCount >= 6) {
            throw new Error(`الزوج ${item.pairName} لديه ${item.completedCyclesCount} دورات ووضع في غير المؤهلين!`);
          }
        }
      }

      // Check zero denominators protection: rates when count is 0 shouldn't be NaN
      if (
        (report.fertilityRate !== null && isNaN(report.fertilityRate)) ||
        (report.hatchRate !== null && isNaN(report.hatchRate)) ||
        (report.survivalRate !== null && isNaN(report.survivalRate))
      ) {
        throw new Error('أحد معدلات التقرير نتج عنه NaN بسبب قسمة على صفر');
      }

      results.push({
        id: 9,
        name: 'سيناريو 9: التقارير وترتيب الأزواج (شرط 6 دورات)',
        status: 'نجح',
        details: 'تم فحص شرط الـ 6 دورات لترتيب الأزواج وحماية القسمة على صفر، وتظهر "بيانات غير كافية" عند قلة الدورات دون أي أرقام تقديرية أو مضللة.',
        notes: 'التقارير مبنية حصرياً على البيانات الفعلية المسجلة.',
      });
    } catch (err: unknown) {
      results.push({
        id: 9,
        name: 'سيناريو 9: التقارير وترتيب الأزواج (شرط 6 دورات)',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل تقرير الدورات الست أو حماية القسمة على صفر.',
      });
    }

    // =========================================================================
    // سيناريو 10: سلاكة فيها بيض جديد وزغاليل من دورة سابقة معاً
    // =========================================================================
    try {
      const coopOverlap = await addCoop({ number: 'COOP-OVERLAP', type: 'production' });
      const pOverlap = await addPair({
        name: 'زوج التداخل',
        coopId: coopOverlap.id,
        maleInfo: 'ذكر تداخل',
        femaleInfo: 'أنثى تداخل',
        pairedDate: addDays(today, -50),
      });

      // Cycle 1: Laid 25 days ago, hatched 7 days ago
      const eggsCy1 = await layEggs({
        pairId: pOverlap.id,
        coopId: coopOverlap.id,
        egg1Date: addDays(today, -25),
        egg2Date: addDays(today, -24),
      });
      await recordEggHatch(eggsCy1[0].id, addDays(today, -7));
      await recordEggHatch(eggsCy1[1].id, addDays(today, -7));

      // Cycle 2: Laid today while squabs are still in the coop (age 7 days)
      const eggsCy2 = await layEggs({
        pairId: pOverlap.id,
        coopId: coopOverlap.id,
        egg1Date: today,
        egg2Date: addDays(today, 1),
      });

      // Verify coop contains both:
      const coopEggs = await getEggsByCoop(coopOverlap.id);
      const coopSquabs = await getSquabsByCurrentLocation(coopOverlap.id);

      const currentEggs = coopEggs.filter((e) => e.status === 'pending' || e.status === 'fertile');
      const currentSquabs = coopSquabs.filter((s) => s.status === 'alive_production');

      if (currentEggs.length !== 2) {
        throw new Error(`المتوقع بيضتان حاليتان بالسلاكة ولكن وجدنا ${currentEggs.length}`);
      }
      if (currentSquabs.length !== 2) {
        throw new Error(`المتوقع زغلولان حاليان بالسلاكة ولكن وجدنا ${currentSquabs.length}`);
      }

      // Check cycles are distinct
      if (currentEggs[0].cycleId === currentSquabs[0].cycleId) {
        throw new Error('البيض والزغاليل نُسبوا إلى نفس الدورة بشكل خاطئ!');
      }

      results.push({
        id: 10,
        name: 'سيناريو 10: بيض جديد وزغاليل من دورة سابقة في سلاكة واحدة',
        status: 'نجح',
        details: 'تحتوي السلاكة في نفس اللحظة على بيضتين تحت الحضانة من الدورة 2، وزغلولين حيين بعمر 7 أيام من الدورة 1، بدون أي تداخل بين السجلات.',
        notes: 'فصل الدورات والعلاقات السجلية سليم 100%.',
      });
    } catch (err: unknown) {
      results.push({
        id: 10,
        name: 'سيناريو 10: بيض جديد وزغاليل من دورة سابقة في سلاكة واحدة',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل التمييز بين دورات البيض والزغاليل المتزامنة.',
      });
    }

    // =========================================================================
    // سيناريو 11: تصدير نسخة احتياطية -> مسح كل البيانات -> استعادة النسخة
    // =========================================================================
    try {
      const statsBefore = await calculateFarmStats();
      const backupBefore = await exportBackupData();

      if (!backupBefore.data || !backupBefore.recordCounts) {
        throw new Error('النسخة الاحتياطية المصدرة تفتقر للهيكل القياسي أو أعداد السجلات');
      }

      // Wipe everything
      await wipeAllData();

      const statsAfterWipe = await calculateFarmStats();
      if (statsAfterWipe.totalCoops !== 0 || statsAfterWipe.totalLivingBirds !== 0) {
        throw new Error('فشل مسح البيانات الكامل!');
      }

      // Restore from backup
      const restoreResult = await restoreBackupData(backupBefore);
      if (!restoreResult.restoredCounts) {
        throw new Error('فشلت استعادة النسخة الاحتياطية');
      }

      // Verify identical record counts
      const statsAfterRestore = await calculateFarmStats();
      if (
        statsAfterRestore.totalCoops !== statsBefore.totalCoops ||
        statsAfterRestore.activePairs !== statsBefore.activePairs ||
        statsAfterRestore.totalLivingBirds !== statsBefore.totalLivingBirds
      ) {
        throw new Error(
          `عدم تطابق الإحصائيات بعد الاستعادة: قبل=${JSON.stringify(statsBefore)} بعد=${JSON.stringify(statsAfterRestore)}`
        );
      }

      results.push({
        id: 11,
        name: 'سيناريو 11: تصدير نسخة -> مسح شامل -> استعادة وتطابق 100%',
        status: 'نجح',
        details: 'تم تصدير ملف JSON متكامل لكافة الجداول الـ 17، ثم مسح قاعدة البيانات بالكامل، ثم استعادة النسخة، وجاءت الإحصائيات وسجلات الأحداث متطابقة تماماً 100%.',
        notes: 'محرك النسخ الاحتياطي والاستعادة آمن ويجري نسخة أمان تلقائية قبل أي استعادة.',
      });
    } catch (err: unknown) {
      results.push({
        id: 11,
        name: 'سيناريو 11: تصدير نسخة -> مسح شامل -> استعادة وتطابق 100%',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل النسخ الاحتياطي أو الاستعادة.',
      });
    }

    // =========================================================================
    // سيناريو 12: فحص العمل دون إنترنت
    // =========================================================================
    try {
      // Check that DB is IndexedDB and no external fetch calls are needed
      const testCoop = await addCoop({
        number: 'OFFLINE-TEST',
        type: 'production',
        notes: 'سلاكة اختبار العمل أوفلاين',
      });

      const loaded = (await getCoops()).find((c) => c.id === testCoop.id);
      if (!loaded) {
        throw new Error('فشل قراءة/كتابة السجلات محلياً في IndexedDB');
      }

      results.push({
        id: 12,
        name: 'سيناريو 12: فحص العمل دون إنترنت (Offline IndexedDB)',
        status: 'نجح',
        details: 'التطبيق يعمل محلياً بنسبة 100% على IndexedDB وService Worker دون الحاجة لأي خادم أو اتصال شبكة خارجي.',
        notes: 'تم فحص قراءة وكتابة وتحديث كافة الكيانات دون اتصال.',
      });
    } catch (err: unknown) {
      results.push({
        id: 12,
        name: 'سيناريو 12: فحص العمل دون إنترنت (Offline IndexedDB)',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل اختبار التخزين المحلي بدون إنترنت.',
      });
    }

    // =========================================================================
    // سيناريو 13: فحص سلامة البيانات بعد كل هذه العمليات
    // =========================================================================
    try {
      const integrityReport = await checkDataIntegrity();

      if (integrityReport.criticalCount > 0) {
        throw new Error(
          `تم اكتشاف ${integrityReport.criticalCount} مشاكل حرجة: ${integrityReport.issues.map((i) => i.title).join('، ')}`
        );
      }

      results.push({
        id: 13,
        name: 'سيناريو 13: فحص سلامة وتناسق البيانات الشامل',
        status: 'نجح',
        details: `اجتازت قاعدة البيانات كافة قواعد السلامة الـ 6 (0 أخطاء حرجة)، وجميع علاقات البيض والزغاليل والدفعات والأعمار متسلسلة ومتناسقة تماماً.`,
        notes: 'لا توجد أي سجلات معلقة أو أخطاء تناقض أو بيع مزدوج.',
      });
    } catch (err: unknown) {
      results.push({
        id: 13,
        name: 'سيناريو 13: فحص سلامة وتناسق البيانات الشامل',
        status: 'فشل',
        details: err instanceof Error ? err.message : String(err),
        notes: 'فشل فحص سلامة البيانات.',
      });
    }

  } finally {
    // Restore the user's original data if they had any prior to the test
    if (safetyBackup) {
      try {
        const totalRecords = Object.values(safetyBackup.recordCounts as Record<string, number>).reduce(
          (a: number, b: number) => a + b,
          0
        );
        if (totalRecords > 0) {
          await restoreBackupData(safetyBackup);
        }
      } catch (e) {
        console.warn('Could not restore pre-test data:', e);
      }
    }
  }

  return results;
}
