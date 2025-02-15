import { ContextTracker, ExternalTokenizer, LRParser } from '@lezer/lr';
import { styleTags, tags } from '@lezer/highlight';
import { parseMixed } from '@lezer/common';

// This file was generated by lezer-generator. You probably shouldn't edit it.
const scriptText = 58,
  StartCloseScriptTag = 1,
  styleText = 59,
  StartCloseStyleTag = 2,
  textareaText = 60,
  StartCloseTextareaTag = 3,
  StartTag = 4,
  StartScriptTag = 5,
  StartStyleTag = 6,
  StartTextareaTag = 7,
  StartSelfClosingTag = 8,
  StartCloseTag = 9,
  NoMatchStartCloseTag = 10,
  MismatchedStartCloseTag = 11,
  missingCloseTag = 61,
  IncompleteCloseTag = 12,
  commentContent$1 = 62,
  Element = 20,
  ScriptText = 29,
  StyleText = 32,
  TextareaText = 35,
  OpenTag = 37,
  Dialect_noMatch = 0;

/* Hand-written tokenizers for HTML. */

const selfClosers = {
  area: true, base: true, br: true, col: true, command: true,
  embed: true, frame: true, hr: true, img: true, input: true,
  keygen: true, link: true, meta: true, param: true, source: true,
  track: true, wbr: true, menuitem: true
};

const implicitlyClosed = {
  dd: true, li: true, optgroup: true, option: true, p: true,
  rp: true, rt: true, tbody: true, td: true, tfoot: true,
  th: true, tr: true
};

const closeOnOpen = {
  dd: { dd: true, dt: true },
  dt: { dd: true, dt: true },
  li: { li: true },
  option: { option: true, optgroup: true },
  optgroup: { optgroup: true },
  p: {
    address: true, article: true, aside: true, blockquote: true, dir: true,
    div: true, dl: true, fieldset: true, footer: true, form: true,
    h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
    header: true, hgroup: true, hr: true, menu: true, nav: true, ol: true,
    p: true, pre: true, section: true, table: true, ul: true, each: true
  },
  rp: { rp: true, rt: true },
  rt: { rp: true, rt: true },
  tbody: { tbody: true, tfoot: true },
  td: { td: true, th: true },
  tfoot: { tbody: true },
  th: { td: true, th: true },
  thead: { tbody: true, tfoot: true },
  tr: { tr: true }
};

function nameChar(ch) {
  return ch == 45 || ch == 46 || ch == 58 || ch >= 65 && ch <= 90 || ch == 95 || ch >= 97 && ch <= 122 || ch >= 161
}

function isSpace(ch) {
  return ch == 9 || ch == 10 || ch == 13 || ch == 32
}

let cachedName = null, cachedInput = null, cachedPos = 0;
function tagNameAfter(input, offset) {
  let pos = input.pos + offset;
  if (cachedPos == pos && cachedInput == input) return cachedName
  let next = input.peek(offset);
  while (isSpace(next)) next = input.peek(++offset);
  let name = "";
  for (; ;) {
    if (!nameChar(next)) break
    name += String.fromCharCode(next);
    next = input.peek(++offset);
  }
  // Undefined to signal there's a <? or <!, null for just missing
  cachedInput = input; cachedPos = pos;
  return cachedName = name ? name : next == question || next == bang ? undefined : null
}

const lessThan = 60, greaterThan = 62, slash = 47, question = 63, bang = 33, dash = 45;

function ElementContext(name, parent) {
  this.name = name;
  this.parent = parent;
  this.hash = parent ? parent.hash : 0;
  for (let i = 0; i < name.length; i++) this.hash += (this.hash << 4) + name.charCodeAt(i) + (name.charCodeAt(i) << 8);
}

const startTagTerms = [StartTag, StartSelfClosingTag, StartScriptTag, StartStyleTag, StartTextareaTag];

const elementContext = new ContextTracker({
  start: null,
  shift(context, term, stack, input) {
    return startTagTerms.indexOf(term) > -1 ? new ElementContext(tagNameAfter(input, 1) || "", context) : context
  },
  reduce(context, term) {
    return term == Element && context ? context.parent : context
  },
  reuse(context, node, stack, input) {
    let type = node.type.id;
    return type == StartTag || type == OpenTag
      ? new ElementContext(tagNameAfter(input, 1) || "", context) : context
  },
  hash(context) { return context ? context.hash : 0 },
  strict: false
});

const tagStart = new ExternalTokenizer((input, stack) => {
  if (input.next != lessThan) {
    // End of file, close any open tags
    if (input.next < 0 && stack.context) input.acceptToken(missingCloseTag);
    return
  }
  input.advance();
  let close = input.next == slash;
  if (close) input.advance();
  let name = tagNameAfter(input, 0);
  if (name === undefined) return
  if (!name) return input.acceptToken(close ? IncompleteCloseTag : StartTag)

  let parent = stack.context ? stack.context.name : null;
  if (close) {
    if (name == parent) return input.acceptToken(StartCloseTag)
    if (parent && implicitlyClosed[parent]) return input.acceptToken(missingCloseTag, -2)
    if (stack.dialectEnabled(Dialect_noMatch)) return input.acceptToken(NoMatchStartCloseTag)
    for (let cx = stack.context; cx; cx = cx.parent) if (cx.name == name) return
    input.acceptToken(MismatchedStartCloseTag);
  } else {
    if (name == "script") return input.acceptToken(StartScriptTag)
    if (name == "style") return input.acceptToken(StartStyleTag)
    if (name == "textarea") return input.acceptToken(StartTextareaTag)

    const isUpperCase = name.charAt(0) === (name.charAt(0)).toUpperCase();
    if (selfClosers.hasOwnProperty(name) || isUpperCase) return input.acceptToken(StartSelfClosingTag)
    if (parent && closeOnOpen[parent] && closeOnOpen[parent][name]) input.acceptToken(missingCloseTag, -1);
    else input.acceptToken(StartTag);
  }
}, { contextual: true });

const commentContent = new ExternalTokenizer(input => {
  for (let dashes = 0, i = 0; ; i++) {
    if (input.next < 0) {
      if (i) input.acceptToken(commentContent$1);
      break
    }
    if (input.next == dash) {
      dashes++;
    } else if (input.next == greaterThan && dashes >= 2) {
      if (i > 3) input.acceptToken(commentContent$1, -2);
      break
    } else {
      dashes = 0;
    }
    input.advance();
  }
});

function contentTokenizer(tag, textToken, endToken) {
  let lastState = 2 + tag.length;
  return new ExternalTokenizer(input => {
    // state means:
    // - 0 nothing matched
    // - 1 '<' matched
    // - 2 '</' + possibly whitespace matched
    // - 3-(1+tag.length) part of the tag matched
    // - lastState whole tag + possibly whitespace matched
    for (let state = 0, matchedLen = 0, i = 0; ; i++) {
      if (input.next < 0) {
        if (i) input.acceptToken(textToken);
        break
      }
      if (state == 0 && input.next == lessThan ||
        state == 1 && input.next == slash ||
        state >= 2 && state < lastState && input.next == tag.charCodeAt(state - 2)) {
        state++;
        matchedLen++;
      } else if ((state == 2 || state == lastState) && isSpace(input.next)) {
        matchedLen++;
      } else if (state == lastState && input.next == greaterThan) {
        if (i > matchedLen)
          input.acceptToken(textToken, -matchedLen);
        else
          input.acceptToken(endToken, -(matchedLen - 2));
        break
      } else if ((input.next == 10 /* '\n' */ || input.next == 13 /* '\r' */) && i) {
        input.acceptToken(textToken, 1);
        break
      } else {
        state = matchedLen = 0;
      }
      input.advance();
    }
  })
}

const scriptTokens = contentTokenizer("script", scriptText, StartCloseScriptTag);

const styleTokens = contentTokenizer("style", styleText, StartCloseStyleTag);

const textareaTokens = contentTokenizer("textarea", textareaText, StartCloseTextareaTag);

const htmlHighlighting = styleTags({
  "Text RawText": tags.content,
  "StartTag StartCloseTag SelfCloserEndTag EndTag SelfCloseEndTag": tags.angleBracket,
  "TagName": tags.tagName,
  "MismatchedCloseTag/TagName": [tags.tagName, tags.invalid],
  "AttributeName": tags.attributeName,
  "AttributeValue EventDirective SvelteOpenTag SvelteCloseTag": tags.attributeValue,
  Is: tags.definitionOperator,
  "EntityReference CharacterReference": tags.character,
  Comment: tags.blockComment,
  "ProcessingInst": tags.processingInstruction,
  DoctypeDecl: tags.documentMeta,
  "SvelteBrackets EventDirectiveEvent UnquotedAttributeValue": tags.keyword
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const parser = LRParser.deserialize({
  version: 14,
  states: ",xOVOxOOO!gQ!bO'#CqO!lQ!bO'#C{O!qQ!bO'#DOO!vQ!bO'#DRO!{Q!bO'#DTO#QOXO'#CpO#]OYO'#CpO#hO[O'#CpO%TOxO'#CpOOOW'#Cp'#CpO%[O!rO'#DUO%dQ!bO'#DZO%iQ!bO'#D[OOOW'#Do'#DoOOOW'#D^'#D^QVOxOOO%nQ#tO,59]O%yQ#tO,59gO&UQ#tO,59jO&aQ#tO,59mO&lQ#tO,59oOOOX'#Db'#DbO&wOXO'#CyO'SOXO,59[OOOY'#Dc'#DcO'[OYO'#C|O'gOYO,59[OOO['#Dd'#DdO'oO[O'#DPO'zO[O,59[OOOW'#De'#DeO(SOxO,59[O(ZQ!bO'#DSOOOW,59[,59[OOO`'#Df'#DfO(`O!rO,59pOOOW,59p,59pO(hQ!bO,59uO(mQ!bO,59vOOOW-E7[-E7[O(rQ#tO'#CsOOQO'#D_'#D_O)QQ#tO1G.wOOOX1G.w1G.wO)]Q#tO1G/ROOOY1G/R1G/RO)hQ#tO1G/UOOO[1G/U1G/UO)sQ#tO1G/XOOOW1G/X1G/XO*OQ#tO1G/ZOOOW1G/Z1G/ZOOOX-E7`-E7`O*ZQ!bO'#CzOOOW1G.v1G.vOOOY-E7a-E7aO*`Q!bO'#C}OOO[-E7b-E7bO*eQ!bO'#DQOOOW-E7c-E7cO*jQ!bO,59nOOO`-E7d-E7dOOOW1G/[1G/[OOOW1G/a1G/aOOOW1G/b1G/bO*oQ&jO,59_OOQO-E7]-E7]OOOX7+$c7+$cOOOY7+$m7+$mOOO[7+$p7+$pOOOW7+$s7+$sOOOW7+$u7+$uO*zQ!bO,59fO+PQ!bO,59iO+UQ!bO,59lOOOW1G/Y1G/YO+ZO,UO'#CvO+iO7[O'#CvOOQO1G.y1G.yOOOW1G/Q1G/QOOOW1G/T1G/TOOOW1G/W1G/WOOOO'#D`'#D`O+wO,UO,59bOOQO,59b,59bOOOO'#Da'#DaO,VO7[O,59bOOOO-E7^-E7^OOQO1G.|1G.|OOOO-E7_-E7_",
  stateData: ",t~O!bOS~OSSOTPOUQOVROWTOY]OZ[O[^O^^O_^O`^Oa^Ob^Oc^Oy^Oz^O{^O|^O!P_O!hZO~OfaO~OfbO~OfcO~OfdO~OfeO~O![fOPmP!_mP~O!]iOQpP!_pP~O!^lORsP!_sP~OSSOTPOUQOVROWTOXqOY]OZ[O[^O^^O_^O`^Oa^Ob^Oc^Oy^Oz^O{^O|^O!hZO~O!_rO~P#sO!`sO!iuO~OfvO~OfwO~O_yOhyOl|O~O_yOhyOl!OO~O_yOhyOl!QO~O_yOhyOl!SO~O_yOhyOl!UO~O![fOPmX!_mX~OP!WO!_!XO~O!]iOQpX!_pX~OQ!ZO!_!XO~O!^lORsX!_sX~OR!]O!_!XO~O!_!XO~P#sOf!_O~O!`sO!i!aO~Ol!bO~Ol!cO~Oi!dO_gXhgXlgX~O_yOhyOl!fO~O_yOhyOl!gO~O_yOhyOl!hO~O_yOhyOl!iO~O_yOhyOl!jO~Of!kO~Of!lO~Of!mO~Ol!nO~Ok!qO!d!oO!f!pO~Ol!rO~Ol!sO~Ol!tO~Oa!uOb!uO!d!wO!e!uO~Oa!xOb!xO!f!wO!g!xO~Oa!uOb!uO!d!{O!e!uO~Oa!xOb!xO!f!{O!g!xO~Obac!hy!P_|z{^hk`~",
  goto: "%t!dPPPPPPPPPPPPPPPPPPPP!e!kP!qPP!}PP#Q#T#W#^#a#d#j#m#p#v#|!ePPPP!e!eP$S$Y$p$v$|%S%Y%`%fPPPPPPPP%lX^OX`pXUOX`pezabcde{}!P!R!TR!q!dRhUR!XhXVOX`pRkVR!XkXWOX`pRnWR!XnXXOX`pQrXR!XpXYOX`pQ`ORx`Q{aQ}bQ!PcQ!RdQ!TeZ!e{}!P!R!TQ!v!oR!z!vQ!y!pR!|!yQgUR!VgQjVR!YjQmWR![mQpXR!^pQtZR!`tS_O`ToXp",
  nodeNames: "⚠ StartCloseTag StartCloseTag StartCloseTag StartTag StartTag StartTag StartTag StartTag StartCloseTag StartCloseTag StartCloseTag IncompleteCloseTag Document EventDirectiveEvent EventDirective Text EntityReference CharacterReference InvalidEntity Element OpenTag TagName Attribute AttributeName Is AttributeValue UnquotedAttributeValue EndTag ScriptText CloseTag OpenTag StyleText CloseTag OpenTag TextareaText CloseTag OpenTag CloseTag SelfClosingTag Comment ProcessingInst SvelteOpenTag SvelteCloseTag SvelteBrackets MismatchedCloseTag CloseTag DoctypeDecl",
  maxTerm: 71,
  context: elementContext,
  nodeProps: [
    ["closedBy", -11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, "EndTag", -4, 21, 31, 34, 37, "CloseTag", 42, "SvelteCloseTag"],
    ["group", -14, 12, 14, 15, 17, 18, 19, 20, 40, 41, 42, 43, 44, 45, 46, "Entity", 16, "Entity TextContent", -3, 29, 32, 35, "TextContent Entity"],
    ["openedBy", 28, "StartTag StartCloseTag", -4, 30, 33, 36, 38, "OpenTag", 43, "SvelteOpenTag"]
  ],
  propSources: [htmlHighlighting],
  skippedNodes: [0],
  repeatNodeCount: 9,
  tokenData: "%=w!aR!bOX%ZXY*cYZ*cZ]%Z]^*c^p%Zpq*cqr%Zrs+jsv%Zvw,Swx3ix}%Z}!O4U!O!P%Z!P!Q7}!Q![%Z![!]9e!]!^%Z!^!_?Q!_!`LU!`!a8s!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#U9e#U#VLv#V#W!8t#W#]9e#]#^!IV#^#c9e#c#d!M[#d#h9e#h#i#'l#i#o9e#o#p#Ln#p$f%Z$f$g&q$g%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U%Z4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!Z%fc!e`!gpkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!a&q!a$f%Z$f$g&q$g~%Z!R&zV!e`!gp`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&qq'hT!gp`POv'awx'wx!^'a!^!_(V!_~'aP'|R`POv'ww!^'w!_~'wp([Q!gpOv(Vx~(Va(iU!e``POr(brs'wsv(bw!^(b!^!_({!_~(b`)QR!e`Or({sv({w~({!Q)bT!e`!gpOr)Zrs(Vsv)Zwx({x~)ZW)vXkWOX)qZ])q^p)qqr)qsw)qx!P)q!Q!^)q!a$f)q$g~)q!a*n^!e`!gp!b^`POX&qXY*cYZ*cZ]&q]^*c^p&qpq*cqr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&q!Z+sT!dh!gp`POv'awx'wx!^'a!^!_(V!_~'a!Z,ZbcPkWOX-cXZ.pZ]-c]^.p^p-cqr-crs.pst/{tw-cwx.px!P-c!P!Q.p!Q!]-c!]!^)q!^!a.p!a$f-c$f$g.p$g~-c!Z-hbkWOX-cXZ.pZ]-c]^.p^p-cqr-crs.pst)qtw-cwx.px!P-c!P!Q.p!Q!]-c!]!^/X!^!a.p!a$f-c$f$g.p$g~-c!R.sTOp.pqs.pt!].p!]!^/S!^~.p!R/XOa!R!Z/`Xa!RkWOX)qZ])q^p)qqr)qsw)qx!P)q!Q!^)q!a$f)q$g~)q!Z0QakWOX1VXZ2aZ]1V]^2a^p1Vqr1Vrs2asw1Vwx2ax!P1V!P!Q2a!Q!]1V!]!^)q!^!a2a!a$f1V$f$g2a$g~1V!Z1[akWOX1VXZ2aZ]1V]^2a^p1Vqr1Vrs2asw1Vwx2ax!P1V!P!Q2a!Q!]1V!]!^2u!^!a2a!a$f1V$f$g2a$g~1V!R2dSOp2aq!]2a!]!^2p!^~2a!R2uOb!R!Z2|Xb!RkWOX)qZ])q^p)qqr)qsw)qx!P)q!Q!^)q!a$f)q$g~)q!Z3rU!fx!e``POr(brs'wsv(bw!^(b!^!_({!_~(b!]4ae!e`!gpkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O5r!O!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!a&q!a$f%Z$f$g&q$g~%Z!]5}d!e`!gpkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!`&q!`!a7]!a$f%Z$f$g&q$g~%Z!T7hV!e`!gp!iQ`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&q!X8WX!e`!gp`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_!`&q!`!a8s!a~&q!X9OVlU!e`!gp`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&q!a9t!YfQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a=oe!e`!gpkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!a&q!a$f%Z$f$g&q$g;=`%Z;=`<%l9e<%l~%Z!R?ZU!e`!gpyPOq)Zqr?mrs(Vsv)Zwx({x~)Z!R?tZ!e`!gpOr)Zrs(Vsv)Zwx({x})Z}!O@g!O!f)Z!f!gAm!g#W)Z#W#XHf#X~)Z!R@nV!e`!gpOr)Zrs(Vsv)Zwx({x})Z}!OAT!O~)Z!RA^T!e`!gp!hPOr)Zrs(Vsv)Zwx({x~)Z!RAtV!e`!gpOr)Zrs(Vsv)Zwx({x!q)Z!q!rBZ!r~)Z!RBbV!e`!gpOr)Zrs(Vsv)Zwx({x!e)Z!e!fBw!f~)Z!RCOV!e`!gpOr)Zrs(Vsv)Zwx({x!v)Z!v!wCe!w~)Z!RClV!e`!gpOr)Zrs(Vsv)Zwx({x!{)Z!{!|DR!|~)Z!RDYV!e`!gpOr)Zrs(Vsv)Zwx({x!r)Z!r!sDo!s~)Z!RDvV!e`!gpOr)Zrs(Vsv)Zwx({x!g)Z!g!hE]!h~)Z!REdW!e`!gpOrE]rsE|svE]vwFbwxGQx!`E]!`!aG|!a~E]qFRT!gpOvE|vxFbx!`E|!`!aFs!a~E|PFeRO!`Fb!`!aFn!a~FbPFsO!PPqFzQ!gp!PPOv(Vx~(VaGVV!e`OrGQrsFbsvGQvwFbw!`GQ!`!aGl!a~GQaGsR!e`!PPOr({sv({w~({!RHVT!e`!gp!PPOr)Zrs(Vsv)Zwx({x~)Z!RHmV!e`!gpOr)Zrs(Vsv)Zwx({x#c)Z#c#dIS#d~)Z!RIZV!e`!gpOr)Zrs(Vsv)Zwx({x#V)Z#V#WIp#W~)Z!RIwV!e`!gpOr)Zrs(Vsv)Zwx({x#h)Z#h#iJ^#i~)Z!RJeV!e`!gpOr)Zrs(Vsv)Zwx({x#m)Z#m#nJz#n~)Z!RKRV!e`!gpOr)Zrs(Vsv)Zwx({x#d)Z#d#eKh#e~)Z!RKoV!e`!gpOr)Zrs(Vsv)Zwx({x#X)Z#X#YE]#Y~)Z!VLaViS!e`!gp`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&q!aMV![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#]9e#]#^!!{#^#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!#[![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#b9e#b#c!'Q#c#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!'a![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#W9e#W#X!+V#X#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!+f!YfQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]!/U!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!/g!YfQ!e`!gp_ThSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]!3V!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}!3V!}#R%Z#R#S!3V#S#T%Z#T#o!3V#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o!3V%o%p%Z%p&a!3V&a&b%Z&b1p!3V1p4U9e4U4d!3V4d4e%Z4e$IS!3V$IS$I`%Z$I`$Ib!3V$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t!3V%#t&/x%Z&/x&Et!3V&Et&FV%Z&FV;'S!3V;'S;:j!7W;:j?&r%Z?&r?Ah!3V?Ah?BY%Z?BY?Mn!3V?Mn~%Z!a!3h!YfQ!e`!gp^PhSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O!3V!O!P!3V!P!Q&q!Q![!3V![!]!3V!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}!3V!}#R%Z#R#S!3V#S#T%Z#T#o!3V#o$f%Z$f$g&q$g$}%Z$}%O!3V%O%W%Z%W%o!3V%o%p%Z%p&a!3V&a&b%Z&b1p!3V1p4U!3V4U4d!3V4d4e%Z4e$IS!3V$IS$I`%Z$I`$Ib!3V$Ib$Je%Z$Je$Jg!3V$Jg$Kh%Z$Kh%#t!3V%#t&/x%Z&/x&Et!3V&Et&FV%Z&FV;'S!3V;'S;:j!7W;:j?&r%Z?&r?Ah!3V?Ah?BY%Z?BY?Mn!3V?Mn~%Z!a!7ce!e`!gpkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!a&q!a$f%Z$f$g&q$g;=`%Z;=`<%l!3V<%l~%Z!a!9T![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#`9e#`#a!<y#a#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!=Y!ZfQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#U!@{#U#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!A[![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#g9e#g#h!EQ#h#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!Ea![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#g9e#g#h!+V#h#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!If![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#b9e#b#c!+V#c#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a!Mk!^fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#b9e#b#c!+V#c#i9e#i#j##g#j#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a##v![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#h9e#h#i!+V#i#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#'{!^fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#[9e#[#]#+w#]#f9e#f#g#/|#g#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#,W![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#]9e#]#^!EQ#^#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#0]!ZfQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#U#4O#U#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#4_![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#b9e#b#c#8T#c#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#8d![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#g9e#g#h#<Y#h#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#<i![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#]9e#]#^#@_#^#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#@n![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#h9e#h#i#Dd#i#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#Ds![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#]9e#]#^#Hi#^#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!a#Hx![fQ!e`!gphSkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx}%Z}!O9e!O!P9e!P!Q&q!Q![9e![!]9e!]!^%Z!^!_)Z!_!a&q!a!c%Z!c!}9e!}#R%Z#R#S9e#S#T%Z#T#c9e#c#d!IV#d#o9e#o$f%Z$f$g&q$g$}%Z$}%O9e%O%W%Z%W%o9e%o%p%Z%p&a9e&a&b%Z&b1p9e1p4U9e4U4d9e4d4e%Z4e$IS9e$IS$I`%Z$I`$Ib9e$Ib$Je%Z$Je$Jg9e$Jg$Kh%Z$Kh%#t9e%#t&/x%Z&/x&Et9e&Et&FV%Z&FV;'S9e;'S;:j=d;:j?&r%Z?&r?Ah9e?Ah?BY%Z?BY?Mn9e?Mn~%Z!Z#Lyi!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dst$0Xtv#Nhvw$,ewx$'ix!P#Nh!P!Q%-}!Q!^#Nh!^!_$*^!_!a$!_!a#o#Nh#o#p%Z#p#q#Nh#q#r%Z#r$f#Nh$f$g$!_$g~#Nh!Z#Nsh!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!R$!h^!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_q$#k[!gp`POY$#dYZ'aZv$#dvw$$awx$$xx!^$#d!^!_$&Q!_#o$#d#o#p'a#p#q$#d#q#r$'P#r~$#dP$$dTOY$$aZ#o$$a#p#q$$a#q#r$$s#r~$$aP$$xO|PP$$}Z`POY$$xYZ'wZv$$xvw$$aw!^$$x!^!_$$a!_#o$$x#o#p'w#p#q$$x#q#r$%p#r~$$xP$%wR|P`POv'ww!^'w!_~'wq$&VX!gpOY$&QYZ(VZv$&Qvx$$ax#o$&Q#o#p(V#p#q$&Q#q#r$&r#r~$&Qq$&yQ!gp|POv(Vx~(Vq$'YT!gp|P`POv'awx'wx!^'a!^!_(V!_~'aa$'p]!e``POY$'iYZ(bZr$'irs$$xsv$'ivw$$aw!^$'i!^!_$(i!_#o$'i#o#p(b#p#q$'i#q#r$)q#r~$'ia$(nZ!e`OY$(iYZ({Zr$(irs$$asv$(ivw$$aw#o$(i#o#p({#p#q$(i#q#r$)a#r~$(ia$)hR!e`|POr({sv({w~({a$)zU!e`|P`POr(brs'wsv(bw!^(b!^!_({!_~(b!R$*e[!e`!gpOY$*^YZ)ZZr$*^rs$&Qsv$*^vw$$awx$(ix#o$*^#o#p)Z#p#q$*^#q#r$+Z#r~$*^!R$+dT!e`!gp|POr)Zrs(Vsv)Zwx({x~)Z!R$,OV!e`!gp|P`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&qX$,jekWOX$,eXY$$aZ]$,e]^$$a^p$,epq$$aqr$,ers$$asw$,ewx$$ax!P$,e!P!Q$$a!Q!^$,e!^!a$$a!a#o$,e#o#p)q#p#q$,e#q#r$-{#r$f$,e$f$g$$a$g~$,eX$.SX|PkWOX)qZ])q^p)qqr)qsw)qx!P)q!Q!^)q!a$f)q$g~)q!Z$.|c!e`!gp|PkW`POX%ZXZ&qZ]%Z]^&q^p%Zpq&qqr%Zrs'asv%Zvw)qwx(bx!P%Z!P!Q&q!Q!^%Z!^!_)Z!_!a&q!a$f%Z$f$g&q$g~%Z!Z$0dp!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#T#Nh#T#U$2h#U#X#Nh#X#Y%!a#Y#]#Nh#]#^%(W#^#_#Nh#_#`%*T#`#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z$2sj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#k#Nh#k#l$4e#l#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z$4pj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#T#Nh#T#U$6b#U#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z$6mj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#]#Nh#]#^$8_#^#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z$8jj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#h#Nh#h#i$:[#i#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z$:gh!e`!gpkW`POX$<RXY$=xYZ$>}Z]$<R]^$=x^p$<Rpq$=xqr$<Rrs$DVsv$<Rvw$,ewx$GUx!P$<R!P!Q$=x!Q!^$<R!^!_$*^!_!a$=x!a#o$<R#o#p$Is#p#q$<R#q#r$Nq#r$f$<R$f$g$=x$g~$<R!Z$<^h!e`!gpkW`POX$<RXY$=xYZ$>}Z]$<R]^$=x^p$<Rpq$=xqr$<Rrs$DVsv$<Rvw$,ewx$GUx!P$<R!P!Q$=x!Q!^$<R!^!_$*^!_!a$=x!a#o$<R#o#p$Is#p#q$<R#q#r$MP#r$f$<R$f$g$=x$g~$<R!R$>R^!e`!gp`POY$=xYZ$>}Zr$=xrs$DVsv$=xvw$$awx$GUx!^$=x!^!_$*^!_#o$=x#o#p$>}#p#q$=x#q#r$Hy#r~$=x!R$?WX!e`!gp`POr$>}rs$?ssv$>}wx$A{x!^$>}!^!_)Z!_#q$>}#q#r$C_#r~$>}q$?zV!gp`POv$?swx$@ax!^$?s!^!_(V!_#q$?s#q#r$A]#r~$?sP$@fT`POv$@aw!^$@a!_#q$@a#q#r$@u#r~$@aP$@|TzP`POv$@aw!^$@a!_#q$@a#q#r$@u#r~$@aq$AfV!gpzP`POv$?swx$@ax!^$?s!^!_(V!_#q$?s#q#r$A]#r~$?sa$BSW!e``POr$A{rs$@asv$A{w!^$A{!^!_({!_#q$A{#q#r$Bl#r~$A{a$BuW!e`zP`POr$A{rs$@asv$A{w!^$A{!^!_({!_#q$A{#q#r$Bl#r~$A{!R$CjX!e`!gpzP`POr$>}rs$?ssv$>}wx$A{x!^$>}!^!_)Z!_#q$>}#q#r$C_#r~$>}q$D^[!gp`POY$DVYZ$?sZv$DVvw$$awx$ESx!^$DV!^!_$&Q!_#o$DV#o#p$?s#p#q$DV#q#r$Fd#r~$DVP$EXZ`POY$ESYZ$@aZv$ESvw$$aw!^$ES!^!_$$a!_#o$ES#o#p$@a#p#q$ES#q#r$Ez#r~$ESP$FTT|PzP`POv$@aw!^$@a!_#q$@a#q#r$@u#r~$@aq$FoV!gp|PzP`POv$?swx$@ax!^$?s!^!_(V!_#q$?s#q#r$A]#r~$?sa$G]]!e``POY$GUYZ$A{Zr$GUrs$ESsv$GUvw$$aw!^$GU!^!_$(i!_#o$GU#o#p$A{#p#q$GU#q#r$HU#r~$GUa$HaW!e`|PzP`POr$A{rs$@asv$A{w!^$A{!^!_({!_#q$A{#q#r$Bl#r~$A{!R$IWX!e`!gp|PzP`POr$>}rs$?ssv$>}wx$A{x!^$>}!^!_)Z!_#q$>}#q#r$C_#r~$>}!Z$JOe!e`!gpkW`POX$IsXZ$>}Z]$Is]^$>}^p$Ispq$>}qr$Isrs$?ssv$Isvw)qwx$A{x!P$Is!P!Q$>}!Q!^$Is!^!_)Z!_!a$>}!a#q$Is#q#r$Ka#r$f$Is$f$g$>}$g~$Is!Z$Kne!e`!gpzPkW`POX$IsXZ$>}Z]$Is]^$>}^p$Ispq$>}qr$Isrs$?ssv$Isvw)qwx$A{x!P$Is!P!Q$>}!Q!^$Is!^!_)Z!_!a$>}!a#q$Is#q#r$Ka#r$f$Is$f$g$>}$g~$Is!Z$M`e!e`!gp|PzPkW`POX$IsXZ$>}Z]$Is]^$>}^p$Ispq$>}qr$Isrs$?ssv$Isvw)qwx$A{x!P$Is!P!Q$>}!Q!^$Is!^!_)Z!_!a$>}!a#q$Is#q#r$Ka#r$f$Is$f$g$>}$g~$Is!Z% Oe!e`!gp|PkW`POX$IsXZ$>}Z]$Is]^$>}^p$Ispq$>}qr$Isrs$?ssv$Isvw)qwx$A{x!P$Is!P!Q$>}!Q!^$Is!^!_)Z!_!a$>}!a#q$Is#q#r$Ka#r$f$Is$f$g$>}$g~$Is!Z%!lj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#T#Nh#T#U%$^#U#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z%$ij!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#V#Nh#V#W%&Z#W#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z%&fj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#[#Nh#[#]$:[#]#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z%(cj!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#Y#Nh#Y#Z$:[#Z#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z%*`j!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#X#Nh#X#Y%,Q#Y#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!Z%,]j!e`!gpkW`POX#NhXY$!_YZ&qZ]#Nh]^$!_^p#Nhpq$!_qr#Nhrs$#dsv#Nhvw$,ewx$'ix!P#Nh!P!Q$!_!Q!^#Nh!^!_$*^!_!a$!_!a#m#Nh#m#n$:[#n#o#Nh#o#p%Z#p#q#Nh#q#r$.o#r$f#Nh$f$g$!_$g~#Nh!R%.Wf!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#T$!_#T#U%/l#U#X$!_#X#Y%6c#Y#]$!_#]#^%:U#^#_$!_#_#`%;a#`#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%/u`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#k$!_#k#l%0w#l#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%1Q`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#T$!_#T#U%2S#U#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%2]`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#]$!_#]#^%3_#^#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%3h`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#h$!_#h#i%4j#i#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%4s^!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#o$!_#o#p&q#p#q$!_#q#r%5o#r~$!_!R%5|V!e`!gp|P{P`POr&qrs'asv&qwx(bx!^&q!^!_)Z!_~&q!R%6l`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#T$!_#T#U%7n#U#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%7w`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#V$!_#V#W%8y#W#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%9S`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#[$!_#[#]%4j#]#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%:_`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#Y$!_#Y#Z%4j#Z#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%;j`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#X$!_#X#Y%<l#Y#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_!R%<u`!e`!gp`POY$!_YZ&qZr$!_rs$#dsv$!_vw$$awx$'ix!^$!_!^!_$*^!_#m$!_#m#n%4j#n#o$!_#o#p&q#p#q$!_#q#r$+s#r~$!_",
  tokenizers: [scriptTokens, styleTokens, textareaTokens, tagStart, commentContent, 0, 1, 2, 3, 4, 5],
  topRules: { "Document": [0, 13] },
  dialects: { noMatch: 0 },
  tokenPrec: 527
});

function getAttrs(element, input) {
  let attrs = Object.create(null);
  for (let att of element.firstChild.getChildren("Attribute")) {
    let name = att.getChild("AttributeName"), value = att.getChild("AttributeValue") || att.getChild("UnquotedAttributeValue");
    if (name) attrs[input.read(name.from, name.to)] =
      !value ? "" : value.name == "AttributeValue" ? input.read(value.from + 1, value.to - 1) : input.read(value.from, value.to);
  }
  return attrs
}

function maybeNest(node, input, tags) {
  let attrs;
  for (let tag of tags) {
    if (!tag.attrs || tag.attrs(attrs || (attrs = getAttrs(node.node.parent, input))))
      return { parser: tag.parser }
  }
  return null
}

// tags: {
//   tag: "script" | "style" | "textarea",
//   attrs?: ({[attr: string]: string}) => boolean,
//   parser: Parser
// }[]

function configureNesting(tags) {
  let script = [], style = [], textarea = [];
  for (let tag of tags) {
    let array = tag.tag == "script" ? script : tag.tag == "style" ? style : tag.tag == "textarea" ? textarea : null;
    if (!array) throw new RangeError("Only script, style, and textarea tags can host nested parsers")
    array.push(tag);
  }
  return parseMixed((node, input) => {
    let id = node.type.id;
    if (id == ScriptText) return maybeNest(node, input, script)
    if (id == StyleText) return maybeNest(node, input, style)
    if (id == TextareaText) return maybeNest(node, input, textarea)
    return null
  })
}

export { configureNesting, parser };
