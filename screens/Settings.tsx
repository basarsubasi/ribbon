import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Menu, 
  Divider,
  ActivityIndicator,
  useTheme,
  Surface,
  IconButton
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useSettings } from '../context/SettingsContext';
import { reCacheBookCovers } from '../utils/coverCacheUtil';
import { exportDatabase, importDatabase } from '../utils/backupUtil';
import SettingsIcon from '../components/SettingsIcon';

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language, setLanguage, dateFormat, setDateFormat, theme: appTheme, setTheme } = useSettings();

  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [dateFormatMenuVisible, setDateFormatMenuVisible] = useState(false);
  const [themeMenuVisible, setThemeMenuVisible] = useState(false);
  const [isRecaching, setIsRecaching] = useState(false);

  const handleReCacheCovers = async () => {
    setIsRecaching(true);
    try {
      const result = await reCacheBookCovers();
      
      if (result.success) {
        const message = result.updatedCount === 0 
          ? 'No books with HTTP cover URLs found to cache.'
          : `Successfully cached ${result.updatedCount} book covers.${result.errorCount > 0 ? ` ${result.errorCount} failed.` : ''}`;
        
        Alert.alert(
          'Cover Re-caching Complete',
          message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Re-caching Failed',
          'Failed to re-cache book covers. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error re-caching covers:', error);
      Alert.alert(
        'Re-caching Failed',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
    setIsRecaching(false);
  };

  const handleGitHubPress = () => {
    Linking.openURL('https://github.com/basarsubasi/ribbon');
  };

  const getLanguageDisplayName = (lang: string) => {
    switch (lang) {
      case 'en': return 'English';
      case 'tr': return 'Türkçe';
      default: return lang;
    }
  };

  const getDateFormatDisplayName = (format: string) => {
    switch (format) {
      case 'dd-mm-yyyy': return 'DD-MM-YYYY';
      case 'mm-dd-yyyy': return 'MM-DD-YYYY';
      default: return format;
    }
  };

  const getThemeDisplayName = (themeType: string) => {
    switch (themeType) {
      case 'light': return t('settings.light');
      case 'dark': return t('settings.dark');
      default: return themeType;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.background }]} elevation={0}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <SettingsIcon 
                width={scale(40)} 
                height={scale(40)} 
                primaryColor={theme.colors.primary}
                secondaryColor={theme.colors.primaryContainer}
                accentColor={theme.colors.primary}
              />
              <Text variant="headlineLarge" style={[styles.appName, { color: theme.colors.primary }]}>
                {t('settings.title')}
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.content}>
          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="options-outline" size={scale(18)} /> Preferences
            </Text>
            
            {/* Language Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="language" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.language')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Choose your preferred language
                    </Text>
                  </View>
                </View>
                <Menu
                  visible={languageMenuVisible}
                  onDismiss={() => setLanguageMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setLanguageMenuVisible(true)}
                      style={styles.selectButton}
                      contentStyle={styles.buttonContent}
                    >
                      <View style={styles.buttonInner}>
                        <Text style={styles.buttonLabel}>{getLanguageDisplayName(language)}</Text>
                        <Ionicons name="chevron-down" size={scale(16)} style={styles.trailingIcon} />
                      </View>
                    </Button>
                  }
                >
                  <Menu.Item 
                    onPress={() => {
                      setLanguage('en');
                      setLanguageMenuVisible(false);
                    }} 
                    title="English"
                    leadingIcon="translate"
                  />
                  <Menu.Item 
                    onPress={() => {
                      setLanguage('tr');
                      setLanguageMenuVisible(false);
                    }} 
                    title="Türkçe"
                    leadingIcon="translate"
                  />
                </Menu>
              </Card.Content>
            </Card>

            {/* Date Format Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="calendar-outline" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.dateFormat')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Set how dates are displayed
                    </Text>
                  </View>
                </View>
                <Menu
                  visible={dateFormatMenuVisible}
                  onDismiss={() => setDateFormatMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setDateFormatMenuVisible(true)}
                      style={styles.selectButton}
                      contentStyle={styles.buttonContent}
                    >
                      <View style={styles.buttonInner}>
                        <Text style={styles.buttonLabel}>{getDateFormatDisplayName(dateFormat)}</Text>
                        <Ionicons name="chevron-down" size={scale(16)} style={styles.trailingIcon} />
                      </View>
                    </Button>
                  }
                >
                  <Menu.Item 
                    onPress={() => {
                      setDateFormat('dd-mm-yyyy');
                      setDateFormatMenuVisible(false);
                    }} 
                    title="DD-MM-YYYY"
                    leadingIcon="calendar"
                  />
                  <Menu.Item 
                    onPress={() => {
                      setDateFormat('mm-dd-yyyy');
                      setDateFormatMenuVisible(false);
                    }} 
                    title="MM-DD-YYYY"
                    leadingIcon="calendar"
                  />
                </Menu>
              </Card.Content>
            </Card>

            {/* Theme Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons 
                      name={appTheme === 'dark' ? "moon" : "sunny"} 
                      size={scale(20)} 
                      color={theme.colors.primary} 
                    />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.theme')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Choose between light and dark mode
                    </Text>
                  </View>
                </View>
                <Menu
                  visible={themeMenuVisible}
                  onDismiss={() => setThemeMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setThemeMenuVisible(true)}
                      style={styles.selectButton}
                      contentStyle={styles.buttonContent}
                    >
                      <View style={styles.buttonInner}>
                        <Text style={styles.buttonLabel}>{getThemeDisplayName(appTheme)}</Text>
                        <Ionicons name="chevron-down" size={scale(16)} style={styles.trailingIcon} />
                      </View>
                    </Button>
                  }
                >
                  <Menu.Item 
                    onPress={() => {
                      setTheme('light');
                      setThemeMenuVisible(false);
                    }} 
                    title={t('settings.light')}
                    leadingIcon="sunny"
                  />
                  <Menu.Item 
                    onPress={() => {
                      setTheme('dark');
                      setThemeMenuVisible(false);
                    }} 
                    title={t('settings.dark')}
                    leadingIcon="moon"
                  />
                </Menu>
              </Card.Content>
            </Card>
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="server-outline" size={scale(18)} /> Data Management
            </Text>
            
            {/* Book Covers Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="images-outline" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.bookCovers')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Re-download and cache book covers from web URLs
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={handleReCacheCovers}
                  disabled={isRecaching}
                  style={styles.actionButton}
                  contentStyle={styles.buttonContent}
                >
                  <View style={styles.buttonInner}>
                    {isRecaching ? (
                      <>
                        <ActivityIndicator size="small" color="white" style={styles.leadingSpinner} />
                        <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.reCachingCovers')}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="refresh" size={scale(18)} color="white" style={styles.leadingIcon} />
                        <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.reCacheCovers')}</Text>
                      </>
                    )}
                  </View>
                </Button>
              </Card.Content>
            </Card>

            {/* Database Backup Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="archive-outline" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.databaseManagement')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Backup and restore your reading data
                    </Text>
                  </View>
                </View>
                <View style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => exportDatabase(dateFormat, t)}
                    style={[styles.actionButton, styles.halfButton]}
                    contentStyle={styles.buttonContent}
                  >
                    <View style={styles.buttonInner}>
                      <Ionicons name="download" size={scale(16)} style={styles.leadingIcon} />
                      <Text style={styles.buttonLabel}>{t('settings.export')}</Text>
                    </View>
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => importDatabase(t)}
                    style={[styles.actionButton, styles.halfButton]}
                    contentStyle={styles.buttonContent}
                  >
                    <View style={styles.buttonInner}>
                      <Ionicons name="cloud-upload" size={scale(16)} style={styles.leadingIcon} />
                      <Text style={styles.buttonLabel}>{t('settings.import')}</Text>
                    </View>
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="information-circle-outline" size={scale(18)} /> About
            </Text>
            
            {/* Source Code Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="logo-github" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.sourceCode')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      View the source code on GitHub
                    </Text>
                  </View>
                </View>
                <Button
                  mode="outlined"
                  onPress={handleGitHubPress}
                  style={styles.actionButton}
                  contentStyle={styles.buttonContent}
                >
                  <View style={styles.buttonInner}>
                    <Ionicons name="logo-github" size={scale(18)} style={styles.leadingIcon} />
                    <Text style={styles.buttonLabel}>GitHub</Text>
                  </View>
                </Button>
              </Card.Content>
            </Card>
          </View>
        </View>

        <View style={{ height: verticalScale(30) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    textTransform: 'lowercase',
  },
  tagline: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: scale(16),
    marginTop: verticalScale(8),
  },
  section: {
    marginBottom: verticalScale(24),
  },
  categoryTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  settingCard: {
    marginBottom: verticalScale(12),
    borderRadius: scale(16),
  },
  cardContent: {
    paddingVertical: verticalScale(16),
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  settingIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(128, 201, 160, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: scale(16),
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: scale(12),
    marginTop: verticalScale(2),
  },
  selectButton: {
    marginTop: verticalScale(4),
  },
  actionButton: {
    marginTop: verticalScale(4),
    borderRadius: scale(12),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  halfButton: {
    flex: 1,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    marginRight: scale(6),
  },
  leadingSpinner: {
    marginRight: scale(8),
  },
  trailingIcon: {
    marginLeft: scale(6),
  },
  buttonLabel: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  buttonLabelInverse: {
    color: 'white',
  },
});