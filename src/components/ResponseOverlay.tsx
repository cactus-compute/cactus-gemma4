import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StreamdownText } from 'react-native-streamdown';

interface ResponseOverlayProps {
  text: string;
  visible: boolean;
  source?: 'device' | 'cloud';
  stats?: string;
  done?: boolean;
  bottomOffset?: number;
}

export function ResponseOverlay({ text, visible, source, stats, done, bottomOffset = 0 }: ResponseOverlayProps) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const prevSourceRef = useRef(source);

  useEffect(() => {
    if (prevSourceRef.current === 'device' && source === 'cloud') {
      Animated.sequence([
        Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
    prevSourceRef.current = source;
  }, [source, cardOpacity]);

  useEffect(() => {
    if (text) scrollRef.current?.scrollToEnd({ animated: false });
  }, [text]);

  if (!visible || !text) return null;

  const isCloud = source === 'cloud';

  const maxHeight = Math.max(100, screenHeight - (insets.top + 8) - (insets.bottom + bottomOffset) - 8);

  // Two-view split: outer carries the shadow (iOS clips shadow on overflow:hidden views),
  // inner carries overflow:hidden for rounded-corner clipping.
  return (
    <Animated.View style={[styles.cardShadow, { top: insets.top + 8, maxHeight, opacity: cardOpacity }]}>
      <View style={styles.cardClip}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <StreamdownText
            markdown={text}
            markdownStyle={markdownStyle}
            containerStyle={styles.mdContainer}
          />
        </ScrollView>
        {done && (
          <View style={styles.footer}>
            {stats && <Text style={styles.stats}>{stats}</Text>}
            <View style={[styles.badge, isCloud ? styles.badgeCloud : styles.badgeDevice]}>
              <View style={[styles.dot, isCloud ? styles.dotCloud : styles.dotDevice]} />
              <Text style={styles.badgeLabel}>{isCloud ? 'Gemini' : 'Gemma'}</Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const markdownStyle = {
  paragraph: { color: '#fff' },
  h1: { color: '#fff' },
  h2: { color: '#fff' },
  h3: { color: '#fff' },
  h4: { color: '#fff' },
  h5: { color: '#fff' },
  h6: { color: '#fff' },
  list: { color: '#fff', bulletColor: '#fff', markerColor: '#fff' },
  strong: { color: '#fff' },
  em: { color: '#fff' },
  code: { color: '#fff', fontSize: 14, backgroundColor: 'transparent', borderColor: 'transparent' },
  codeBlock: { color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  link: { color: '#fff' },
  blockquote: { color: '#fff', backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)' },
  table: { color: '#fff', headerTextColor: '#fff', headerBackgroundColor: 'rgba(255,255,255,0.1)', rowEvenBackgroundColor: 'transparent', rowOddBackgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' },
  math: { color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)' },
  inlineMath: { color: '#fff' },
  taskList: { checkedTextColor: '#fff', checkedColor: '#fff', borderColor: 'rgba(255,255,255,0.5)', checkmarkColor: '#000' },
  strikethrough: { color: '#fff' },
  underline: { color: '#fff' },
  thematicBreak: { color: 'rgba(255,255,255,0.3)' },
};

const styles = StyleSheet.create({
  // Shadow on outer view — overflow:hidden would clip it on iOS.
  cardShadow: {
    position: 'absolute',
    alignSelf: 'center',
    width: '90%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // Content clipped to rounded corners on inner view.
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,30,0.85)',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  mdContainer: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  stats: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  badgeCloud: { backgroundColor: 'rgba(66,133,244,0.25)' },
  badgeDevice: { backgroundColor: 'rgba(255,255,255,0.1)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotCloud: { backgroundColor: '#4285f4' },
  dotDevice: { backgroundColor: '#34c759' },
  badgeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
});
