
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import {
  Text,
  Card,
  Button,
  Surface,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import BookIcon from '../components/BookIcon';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';


const { width } = Dimensions.get('window');


const Home = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalBooks: 0,
    currentlyReading: 0,
    pagesReadToday: 0,
    pagesReadThisWeek: 0,
    readingStreak: 0,
  });

  // Mock data - in real app, this would come from database
  useEffect(() => {
    // Simulate loading stats from database
    setStats({
      totalBooks: 12,
      currentlyReading: 3,
      pagesReadToday: 25,
      pagesReadThisWeek: 142,
      readingStreak: 7,
    });
  }, []);

  const StatCard = ({ title, value, subtitle, progress }: {
    title: string;
    value: string | number;
    subtitle?: string;
    progress?: number;
  }) => (
    <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]} mode="contained">
      <Card.Content style={styles.statContent}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, opacity: 0.7 }}>
          {title}
        </Text>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
          {value}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurface, opacity: 0.6 }}>
            {subtitle}
          </Text>
        )}
        {progress !== undefined && (
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <BookIcon 
                width={scale(40)} 
                height={scale(40)} 
                primaryColor={theme.colors.primary}
                secondaryColor={theme.colors.primaryContainer}
                accentColor={theme.colors.secondary}
              />
              <Text variant="headlineLarge" style={[styles.appName, { color: theme.colors.primary }]}>
                ribbon
              </Text>
            </View>
            <Text variant="bodyLarge" style={[styles.tagline, { color: theme.colors.onSurface }]}>
              {t('home.appTagline')}
            </Text>
          </View>
        </Surface>

        {/* Continue Reading Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            {t('home.continueReading')}
          </Text>
          <Card style={[styles.continueCard, { backgroundColor: theme.colors.primaryContainer }]} mode="contained">
            <Card.Content>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {t('home.noBooksInProgress')}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8, marginTop: verticalScale(4) }}>
                {t('home.startReadingPrompt')}
              </Text>
              <Button
                mode="contained"
                style={[styles.addBookButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('Library' as never)}
                contentStyle={{ paddingVertical: verticalScale(4) }}
                labelStyle={{ color: '#FFFFFF' }}
              >
                {t('home.browseLibrary')}
              </Button>
            </Card.Content>
          </Card>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            {t('home.readingStats')}
          </Text>
          <View style={styles.statsGrid}>
            <StatCard title={t('home.totalBooks')} value={stats.totalBooks} />
            <StatCard title={t('home.currentlyReading')} value={stats.currentlyReading} />
            <StatCard 
              title={t('home.pagesToday')} 
              value={stats.pagesReadToday} 
              subtitle={t('home.greatProgress')} 
              progress={0.6}
            />
            <StatCard 
              title={t('home.thisWeek')} 
              value={stats.pagesReadThisWeek} 
              subtitle={t('home.pagesRead')}
            />
            <StatCard 
              title={t('home.readingStreak')} 
              value={`${stats.readingStreak} ${t('home.days')}`} 
              subtitle={t('home.keepItUp')}
            />
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(24),
    marginBottom: verticalScale(8),
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  appName: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: moderateScale(2),
  },
  tagline: {
    opacity: 0.7,
  },
  section: {
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(24),
  },
  sectionTitle: {
    marginBottom: verticalScale(16),
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  statCard: {
    width: (width - scale(52)) / 2,
    marginBottom: verticalScale(12),
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: verticalScale(16),
  },
  progressBar: {
    marginTop: verticalScale(8),
    height: verticalScale(4),
    borderRadius: scale(2),
  },
  continueCard: {
    padding: scale(8),
  },
  addBookButton: {
    marginTop: verticalScale(16),
    alignSelf: 'flex-start',
  },
  bottomSpacing: {
    height: verticalScale(60),
  },
});

export default Home;
