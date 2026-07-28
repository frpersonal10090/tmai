/*
TM AI

Copyright (C) 2026

AI Level 6 currently has the same behavior as AI Level 5.  Keeping it as a
separate subclass gives later Level 6 work an isolated extension point without
changing the Level 5 implementation.
*/

var AILevel6 = function() {
  AILou.call(this, 5);
};
inherit(AILevel6, AILou);
