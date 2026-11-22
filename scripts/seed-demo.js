// 체험용 가상 학급(DEMO26)을 DB에 추가합니다. 교사: demo / demo1234, 학생 PIN: 1234
process.env.PORT = process.env.PORT || '0';
const { db, sec } = await import('../server/server.js');
const { seedDemo } = await import('../core/seed.js');
const made = await seedDemo({ db, sec });
console.log(made ? '체험용 학급 DEMO26을 만들었어요.' : '체험용 학급이 이미 있어요.');
process.exit(0);
