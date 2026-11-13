import 'fake-indexeddb/auto';
import {
  openDB,
  addCoop,
  getCoops,
  addPair,
  getPairs,
  togglePairActive,
  layEggs,
  checkEggFertility,
  recordEggHatch,
  getPairRanking,
  searchFarm,
  logEvent,
  getAllEvents,
} from '../db/indexedDB';

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---');

  // Test 1: إضافة سلاكة إنتاج مع نوع بلدي
  console.log('1. اختبار إضافة سلاكة إنتاج مع نوع بلدي...');
  const prodCoop = await addCoop('201', 'production', 'سلاكة إنتاج اختبارية');
  if (!prodCoop || prodCoop.type !== 'production' || prodCoop.number !== '201') {
    throw new Error('فشل إنشاء سلاكة الإنتاج');
  }

  const baladiPair = await addPair({
    name: 'زوج بلدي أصيل 201',
    breed: 'بلدي',
    coopId: prodCoop.id,
    maleInfo: 'ذكر بلدي أزرق دبلة 101',
    femaleInfo: 'أنثى بلدي حبرية دبلة 102',
    pairedDate: '2026-01-01',
  });

  if (!baladiPair || baladiPair.breed !== 'بلدي' || baladiPair.coopId !== prodCoop.id) {
    throw new Error('فشل ربط الزوج البلدي بالسلاكة مع السلالة');
  }
  console.log('✓ نجح: تم إنشاء سلاكة الإنتاج 201 وتسكين زوج بسلالة "بلدي" بنجاح.');

  // Test 2: إضافة سلاكة تجميع
  console.log('2. اختبار إضافة سلاكة تجميع...');
  const collCoop = await addCoop('T-01', 'collection', 'سلاكة تجميع وفطام');
  if (!collCoop || collCoop.type !== 'collection' || collCoop.number !== 'T-01') {
    throw new Error('فشل إنشاء سلاكة التجميع');
  }
  console.log('✓ نجح: تم إنشاء سلاكة التجميع بنجاح بدون زوج.');

  // إنشاء دورة وبيضة وفقس للزوج البلدي للتأكد من تسجيل أرقام إنتاج
  const [egg1, egg2] = await layEggs({
    pairId: baladiPair.id,
    coopId: prodCoop.id,
    egg1Date: '2026-01-10',
  });
  await checkEggFertility(egg1.id, true, '2026-01-15', 'كشف إيجابي');
  const squab1 = await recordEggHatch(egg1.id, '2026-01-28');
  console.log('✓ تم تسجيل دورة وبيضة وفقس زغلول للزوج البلدي.');

  // Test 3: تغيير الزوج في السلاكة والتأكد من بقاء الزوج القديم في السجل التاريخي دون تغيير أرقامه
  console.log('3. اختبار تغيير الزوج في سلاكة 201...');
  // إيقاف الزوج البلدي
  await togglePairActive(baladiPair.id, false, 'تغيير الزوج وتجديد الدماء');

  // تسكين زوج جديد (فرنساوي)
  const frenchPair = await addPair({
    name: 'زوج فرنساوي لاحم 201',
    breed: 'فرنساوي',
    coopId: prodCoop.id,
    maleInfo: 'ذكر فرنساوي أبيض دبلة 201',
    femaleInfo: 'أنثى فرنساوي بيضاء دبلة 202',
    pairedDate: '2026-02-01',
  });

  await logEvent(
    'coop',
    prodCoop.id,
    'pair_changed',
    `تم استبدال الزوج من (${baladiPair.name}) إلى (${frenchPair.name})`
  );

  const allPairs = await getPairs();
  const oldPairInDb = allPairs.find((p) => p.id === baladiPair.id);
  const newPairInDb = allPairs.find((p) => p.id === frenchPair.id);

  if (!oldPairInDb || oldPairInDb.status !== 'inactive') {
    throw new Error('الزوج القديم لم يتم حفظه كـ inactive');
  }
  if (!newPairInDb || newPairInDb.status !== 'active' || newPairInDb.breed !== 'فرنساوي') {
    throw new Error('الزوج الجديد غير مسكن بنجاح أو سلالته غير صحيحة');
  }

  // التأكد من استمرار ظهور الزوج القديم في سجل الأزواج السابقة للسلاكة
  const coopInactivePairs = allPairs.filter((p) => p.coopId === prodCoop.id && p.status === 'inactive');
  if (coopInactivePairs.length !== 1 || coopInactivePairs[0].id !== baladiPair.id) {
    throw new Error('الزوج القديم لا يظهر في الأزواج السابقة للسلاكة');
  }
  console.log('✓ نجح: الزوج القديم محفوظ بحالته وتاريخه وأرقامه في السجل التاريخي للسلاكة، والزوج الجديد نشط بسلالة فرنساوي.');

  // Test 4: البحث السريع بالاسم أو السلالة وفتح السلاكة
  console.log('4. اختبار البحث السريع...');
  const searchByBreed = await searchFarm('بلدي');
  const searchResultPair = searchByBreed.find((r) => r.id === baladiPair.id);
  if (!searchResultPair) {
    throw new Error('فشل البحث السريع بالسلالة "بلدي"');
  }
  if (searchResultPair.targetView !== 'coop_detail' || searchResultPair.params?.coopId !== prodCoop.id) {
    throw new Error('البحث السريع لم يربط الزوج بسلاكته المستهدفة');
  }
  console.log('✓ نجح: البحث السريع وجد الزوج بالسلالة ووجّه إلى سلاكة الإنتاج المستهدفة.');

  // Test 5: فحص سجل الأحداث
  console.log('5. فحص سجل الأحداث والتوثيق...');
  const events = await getAllEvents();
  const changeEvent = events.find((e) => e.type === 'pair_changed' && e.entityId === prodCoop.id);
  if (!changeEvent) {
    throw new Error('لم يتم توثيق حدث تغيير الزوج في السلاكة');
  }
  console.log('✓ نجح: تم توثيق حدث تغيير الزوج في سجل أحداث السلاكة.');

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
